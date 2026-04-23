# Tomato 账单分账

**[English](README.md)** | **简体中文**

一个用于在多人之间分摊共同开销的小型**交互式终端应用**。当某人代付一笔惠及多人的支出时，你可以记录付款人、金额以及应由哪些人分摊。工具会跟踪每个人的净余额，并在结束时建议**最少人次的一对一转账**，让结清时尽量少折腾。

## 适用场景

适合聚餐、旅行或室友公摊账单后使用：可以边记边录入，也可以一次录完，然后用 **结清 (Settle up)** 查看谁应给谁多少钱，避免有人长期多垫钱。

## 环境要求

- Python 3.10+（推荐）
- 依赖见 `requirements.txt`（[Rich](https://github.com/Textualize/rich) 用于命令行界面，[FastAPI](https://fastapi.tiangolo.com/) + [Uvicorn](https://www.uvicorn.org/) 用于可选的 Web 界面，[openpyxl](https://openpyxl.readthedocs.io/) 用于 Excel 导出）

## 安装

在项目目录下执行：

```bash
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## 如何运行

**终端（CLI）：**

```bash
python split_bill.py
```

将进入菜单式终端界面。

**Web 界面（浏览器）：**

```bash
uvicorn web_server:app --reload --host 127.0.0.1 --port 8000
```

在浏览器打开 [http://127.0.0.1:8000](http://127.0.0.1:8000)。页面会在 `localStorage` 中保存会话 id；**清空重来** 可清除该会话下的账单。**下载 Excel** 与 CLI 选项 **5** 使用相同的表格格式。

### Web 界面示例

**1.** 添加一笔账单（金额、付款人、分摊人）并查看 **Balances（余额）**。

![Web：添加账单并查看余额](assets/image.png)

**2.** 查看 **Settlements（结清建议）** 与 **Bill history（账单历史）** 表格。

![Web：结清建议与账单历史](assets/image2.png)

## 使用说明

| 选项 | 作用 |
|------|------|
| **1 — Add a bill** | 输入**金额**、**付款人**、**消费人**（在消费者之间**平均**分摊）。若消费人留空直接回车，则包含当前组内所有人。姓名可用空格或逗号分隔。新名字会被记住，供后续账单使用。 |
| **2 — View balances** | 显示每人净余额：为正表示别人欠 TA；为负表示 TA 欠别人。 |
| **3 — View bill history** | 列出已记录账单，含 ID、付款人、金额、参与人。 |
| **4 — Delete a bill** | 按历史中的 **#** 删除一笔账单并重新计算余额（适合输错时纠正）。 |
| **5 — Settle up & exit** | 先显示账单历史（如有），再打印建议转账：*欠款方 → 收款方 : 金额*，尽量用最少笔数结清，随后程序退出。 |

### 提示

- **仅支持平均分摊**：每笔账单总额在列出的所有消费者之间平均分配（若付款人也在该列表中，则包含在内）。
- 可用 **Ctrl+C** 中断当前输入（例如录账单时）；在安全时会回到主菜单。
- 执行选项 **5** 退出后，若需新会话，可再次运行 `python split_bill.py`。
