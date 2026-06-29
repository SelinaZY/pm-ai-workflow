# PM AI 工作流

> 一套我用 **Claude Code** 自建的产品经理工作流：输入一句需求，AI 自动串联「需求探索 → 调研 → PRD → 评审 → 交互设计 → 原型 → 验收」的完整设计闭环，研发上线后再一键触发验收执行。

这不是调用现成 AI 工具的集合，而是我把自己的 PM 方法论沉淀成一套**可自动编排的 Skill 系统**——每个阶段是一个独立 Skill，由一个主编排器（`pm-workflow`）按需求复杂度选择 Lite / Full 模式串联执行，机械性子任务自动委派给 subagent 以控制上下文成本。

---

## 🔗 在线演示 & 完整案例

两个真实需求各自从头跑通整条流程，产出全部留档：

### 案例 A · 风格画布 StyleCanvas（文档/画布类 AI 工具）
> 一句话描述界面 + 指定设计风格 → AI 在无限画布上生成高保真界面块，可拖拽编排、连线成流程；选中 frame 可 AI 局部改写/换风格，产出以「接受/拒绝/diff」态落定。展示对**智能画布 + AI 介入交互范式**的设计判断。

| 阶段 | 产出 |
|------|------|
| 0 需求探索 | [0-需求探索.md](examples/ai-canvas/0-需求探索.md) |
| 1 需求调研 | [1-需求调研.md](examples/ai-canvas/1-需求调研.md) |
| 2 PRD | [2-PRD.md](examples/ai-canvas/2-PRD.md) |
| 3 需求评审 | [3-需求评审.md](examples/ai-canvas/3-需求评审.md) |
| 4 交互设计 | [4-交互设计.md](examples/ai-canvas/4-交互设计.md) |
| 5 高保真原型 | **🖥️ [在线可交互 Demo](https://selinazy.github.io/pm-ai-workflow/examples/ai-canvas/prototype/)** ｜ [源码](examples/ai-canvas/prototype/index.html) |

### 案例 B · 重大生活决策比较工具（租房场景）
> 一个完整的端到端流程留档，展示工作流在 C 端需求上的完整链路与 JTBD 拆解。

| 阶段 | 产出 |
|------|------|
| 0 探索 | [0-需求探索.md](examples/decision-tool/0-需求探索.md) ｜ 1 [调研](examples/decision-tool/1-需求调研.md) ｜ 2 [PRD](examples/decision-tool/2-PRD.md) ｜ 3 [评审](examples/decision-tool/3-需求评审.md) ｜ 4 [交互](examples/decision-tool/4-交互设计.md) ｜ 5 [原型 Demo](https://selinazy.github.io/pm-ai-workflow/examples/decision-tool/prototype/) |

> 在线 Demo 链接在仓库开启 GitHub Pages 后生效。

工作流总览页：[`docs/pm-workflow-overview.html`](docs/pm-workflow-overview.html)

---

## 八个阶段

```
阶段零：需求探索（Brainstorming，交互式）
    ↓ 用户回复「继续」
┌─ 阶段一：需求调研  ─→  阶段二：PRD 编写  ─→  阶段三：需求评审
│   ↓
│  阶段四：交互设计 + 交互审查 → 页面知识库更新（设计态）
│   ↓
│  阶段五：原型设计（可选，纯后端需求自动跳过）
│   ↓
└─ 阶段六：验收 Case 设计  ← 设计闭环终点（自动串联）
   ─────────  研发实现 / 部署上线  ─────────
   阶段七：验收执行（用户说「验收一下」手动触发）
```

| 阶段 | Skill | 产出文件 |
|------|------|---------|
| 零：需求探索 | `pm-brainstorming` | `workspace/brainstorming/YYYY-MM-DD-{feature}-design.md` |
| 一：需求调研 | `research` | `workspace/research/需求调研_{feature}_{date}.md` |
| 二：PRD 编写 | `write-prd` | `workspace/prd/PRD_{feature}_v0.1.md` |
| 三：需求评审 | `review-prd` | `workspace/prd/评审_{feature}_{date}.md` |
| 四：交互设计 + 审查 | `ixd` → `review-ixd` | `workspace/ixd/交互设计说明_{feature}_v0.1.md` |
| 五：原型设计 | `prototype` | `workspace/prototype/{feature}/`（HTML） |
| 六：验收 Case 设计 | `acceptance` 子流程 A | `workspace/acceptance/{feature}/验收Case_{feature}_v0.1.md` |
| 七：验收执行（手动） | `acceptance` 子流程 B | `workspace/acceptance/{feature}/验收报告_{feature}_{date}.html/.md` |

---

## 设计亮点

- **主编排器 + 子任务委派**：`pm-workflow` 统一编排，长输入/模板化的机械任务（文档整理、DOM diff、竞品摘要、验收 Case 填充）委派给 subagent，关键决策（brainstorming、PRD 方案、评审阻塞判定、关键交互）保留在主会话。
- **Lite / Full 双模式**：小需求（文案/字段/单页改造）只跑「探索 + PRD」，避免重型流程拖累；复杂需求跑全链路。模式由编排器自动判定并向用户确认。
- **阻断式自动串联**：阶段一~六自动连跑，遇到 NO-GO 调研结论、评审阻塞项、缺现状文档等情况立即暂停等待决策，而非盲目继续。
- **原型设计参考三级兜底**：① 照抄已采集的线上 DOM（与真实产品一致）→ ② 全新产品按声明的设计参考生成（内置 `document-canvas` 文档/画布类设计语言，含 AI 介入交互范式与"接受/拒绝/diff"确定性边界）→ ③ Ant Design 最后兜底。避免给文档/画布/C 端产品套上"后台表格风"。
- **设计态 / 线上态双知识库**：交互设计落地后回写页面知识库，与线上采集结果分别留痕。

---

## 技能清单

所有技能位于 `.claude/skills/<name>/SKILL.md`，通过自然语言描述匹配自动触发，也可独立调用。

| Skill | 触发方式 | 职责 |
|------|---------|------|
| `pm-workflow` | 描述新需求时自动触发 | 主编排器，串联所有阶段 |
| `pm-brainstorming` / `brainstorming` | 阶段零自动触发 | 对话探索需求，产出设计文档 |
| `research` | 「调研一下」「可行性分析」 | JTBD 解构、竞品分析、GO/NO-GO 决策 |
| `write-prd` | 「写 PRD」 | 标准十章节 PRD |
| `review-prd` | 「评审 PRD」 | 研发视角评审，红/黄/绿三级问题 |
| `ixd` | 「交互设计」 | 页面清单、ASCII 线框图、跳转规则、状态矩阵 |
| `review-ixd` | ixd 完成后自动触发 | 交互审查 + 页面知识库更新 |
| `prototype` | ixd 完成后自动触发 | HTML 原型 |
| `acceptance` | 「写验收 case」/「验收一下」 | 验收 Case 设计 + 截图 AI 判定报告 |
| `capture-page` | 「采集页面」 | 页面现状采集（Playwright），更新知识库 |
| `impact-check` | 「影响检查」 | 流程/产物改动后扫描需同步更新的位置 |
| `checkpoint` | 「checkpoint」 | 长会话中途保存进度快照 |

---

## 前置要求

- **Claude Code** 已安装并配置
- **Playwright**（页面采集 / 验收截图 / 原型基础需要）
- **Figma MCP**（仅新增页面原型设计需要，可选）

---

## 关于这个仓库

本仓库是从我个人的 PM 工作流中**抽取出的方法论与技能框架**，配一个中立的演示案例。所有内容均为通用产品方法论与工具编排，不含任何雇主或客户的产品信息、商业数据。
