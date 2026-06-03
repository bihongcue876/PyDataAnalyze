"""生成测试数据集

生成两份 CSV 文件到 data/ 目录：
1. ecommerce_customers.csv — 电商用户消费数据（200行，适合聚类+可视化+清洗）
2. student_scores.csv — 学生成绩数据（100行，适合清洗+图表+导出）

用法: python scripts/generate_test_data.py
"""

import os
import pandas as pd
import numpy as np

# 设置随机种子，保证可复现
np.random.seed(42)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")


# ============================================================
# 数据集 1: 电商用户消费数据
# ============================================================
def generate_ecommerce_data(n=200):
    """生成电商用户消费数据，包含3个天然聚类和人工注入的脏数据"""

    # 3 个客户群的中心
    clusters = [
        {"mean_age": 25, "mean_income": 35, "mean_score": 80, "mean_freq": 20, "mean_value": 80, "size": 70},   # 年轻高活跃
        {"mean_age": 45, "mean_income": 85, "mean_score": 40, "mean_freq": 5,  "mean_value": 300, "size": 60},   # 中年高收入低频
        {"mean_age": 33, "mean_income": 55, "mean_score": 60, "mean_freq": 12, "mean_value": 150, "size": 70},   # 中等均衡型
    ]

    records = []
    for cl in clusters:
        for _ in range(cl["size"]):
            records.append({
                "Age": max(18, min(70, int(np.random.normal(cl["mean_age"], 6)))),
                "AnnualIncome": max(15, min(120, round(np.random.normal(cl["mean_income"], 12), 1))),
                "SpendingScore": max(1, min(100, int(np.random.normal(cl["mean_score"], 10)))),
                "PurchaseFrequency": max(1, min(30, int(np.random.normal(cl["mean_freq"], 4)))),
                "AvgOrderValue": max(5, min(500, round(np.random.normal(cl["mean_value"], 40), 1))),
            })

    df = pd.DataFrame(records)
    df.insert(0, "CustomerID", range(1, n + 1))

    # 添加分类字段
    levels = ["Bronze", "Silver", "Gold", "Platinum"]
    probs = [0.15, 0.35, 0.35, 0.15]  # 正态分布
    df["MembershipLevel"] = np.random.choice(levels, n, p=probs)
    df["Region"] = np.random.choice(["North", "South", "East", "West"], n, p=[0.3, 0.25, 0.25, 0.2])

    # 距上次购物天数
    df["LastPurchaseDays"] = np.random.randint(1, 366, size=n)

    # --- 注入脏数据 ---

    # 1. 缺失值: Age 5个缺失, LastPurchaseDays 5个缺失
    missing_indices = np.random.choice(df.index, 5, replace=False)
    df.loc[missing_indices, "Age"] = np.nan
    missing_indices = np.random.choice(df.index, 5, replace=False)
    df.loc[missing_indices, "LastPurchaseDays"] = np.nan

    # 2. 异常值: AnnualIncome 1个极高值, PurchaseFrequency 1个极高值
    df.loc[0, "AnnualIncome"] = 250.0   # 远超正常范围
    df.loc[1, "PurchaseFrequency"] = 60  # 远超正常范围

    # 3. 重复行: 2 条完全重复
    dup_row = df.iloc[5].copy()
    df = pd.concat([df, pd.DataFrame([dup_row, dup_row])], ignore_index=True)

    # 打乱顺序
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)

    return df


# ============================================================
# 数据集 2: 学生成绩数据
# ============================================================
def generate_student_data(n=100):
    """生成学生成绩数据，包含缺失值、异常值和重复记录"""

    surnames = ["张", "李", "王", "赵", "刘", "陈", "杨", "黄", "周", "吴",
                "徐", "孙", "马", "朱", "胡", "林", "郭", "何", "高", "罗"]
    given_names = ["伟", "芳", "娜", "敏", "静", "丽", "强", "磊", "洋", "勇",
                   "艳", "杰", "琳", "军", "秀英", "明", "华", "超", "雪", "涛"]

    names = [f"{np.random.choice(surnames)}{np.random.choice(given_names)}" for _ in range(n)]

    # 3 个班级
    classes = np.random.choice(["A", "B", "C"], n, p=[0.35, 0.35, 0.30])
    genders = np.random.choice(["男", "女"], n, p=[0.5, 0.5])

    # 成绩（设计不同班级的平均分差异）
    class_means = {"A": 75, "B": 65, "C": 70}
    class_stds = {"A": 8, "B": 12, "C": 10}

    chinese_scores = []
    math_scores = []
    english_scores = []

    for cl in classes:
        chinese_scores.append(np.random.normal(class_means[cl] + 2, class_stds[cl]))
        math_scores.append(np.random.normal(class_means[cl], class_stds[cl]))
        english_scores.append(np.random.normal(class_means[cl] + 1, class_stds[cl]))

    df = pd.DataFrame({
        "StudentID": range(2024001, 2024001 + n),
        "Name": names,
        "Class": classes,
        "Gender": genders,
        "Chinese": np.clip(np.round(chinese_scores, 1), 0, 100),
        "Math": np.clip(np.round(math_scores, 1), 0, 100),
        "English": np.clip(np.round(english_scores, 1), 0, 100),
        "Attendance": np.clip(np.round(np.random.normal(0.88, 0.08, n), 2), 0.5, 1.0),
        "StudyHours": np.clip(np.round(np.random.normal(6, 2.5, n), 1), 0, 12),
    })

    # 计算总分
    df["Total"] = df["Chinese"] + df["Math"] + df["English"]

    # --- 注入脏数据 ---

    # 1. 缺失值: 语文2个, 数学3个, 英语2个
    for col, cnt in [("Chinese", 2), ("Math", 3), ("English", 2)]:
        idx = np.random.choice(df.index, cnt, replace=False)
        df.loc[idx, col] = np.nan

    # 2. 异常值: 1个数学极端低值
    df.loc[0, "Math"] = 5.0

    # 3. 异常值: 1个出勤率异常低值
    df.loc[1, "Attendance"] = 0.2

    # 4. 重复行: 2 条完全重复
    dup_row = df.iloc[3].copy()
    df = pd.concat([df, pd.DataFrame([dup_row, dup_row])], ignore_index=True)

    # 打乱顺序
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)

    return df


# ============================================================
# 主程序
# ============================================================
def main():
    os.makedirs(DATA_DIR, exist_ok=True)

    print("正在生成电商用户消费数据...")
    df1 = generate_ecommerce_data(200)
    path1 = os.path.join(DATA_DIR, "ecommerce_customers.csv")
    df1.to_csv(path1, index=False, encoding="utf-8-sig")
    print(f"  → 已保存: {path1}")
    print(f"    形状: {df1.shape}, 缺失值: {df1.isna().sum().sum()}, 列: {list(df1.columns)}")

    print()
    print("正在生成学生成绩数据...")
    df2 = generate_student_data(100)
    path2 = os.path.join(DATA_DIR, "student_scores.csv")
    df2.to_csv(path2, index=False, encoding="utf-8-sig")
    print(f"  → 已保存: {path2}")
    print(f"    形状: {df2.shape}, 缺失值: {df2.isna().sum().sum()}, 列: {list(df2.columns)}")

    print()
    print("=== 生成完成 ===")
    print(f"数据集数量: 2 份")
    print(f"总路径: {DATA_DIR}")


if __name__ == "__main__":
    main()
