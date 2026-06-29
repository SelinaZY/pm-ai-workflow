---
name: pm-workflow
description: 当用户说「帮我调研[功能]」「在[产品]上增加[功能]」「[产品]新需求：[功能]」或描述一个需要推进完整 PM 流程的新功能需求时触发。支持「轻量模式」（小需求只跑 brainstorming + PRD）。
---

# PM 工作流编排器

## 触发后立即执行

1. 从用户描述识别 `product` 和 `feature`（无法确定时列出 `products/` 下的产品让用户选择）
2. 静默读取 `products/{product}.md`
3. **判断流程模式**（见下方「流程模式判定」），输出模式确认
4. 在 `workspace/pipeline_index.json` 注册本次 feature（已存在则跳过）
5. 输出启动确认，进入阶段零：

```
📦 {产品名} · {feature}
🎚️ 流程模式：{Lite | Full}（理由：{一句话}）
→ 开始阶段零：需求探索（Brainstorming）
```

用户可回复「改成 Full」或「改成 Lite」切换模式。

---

## 流程模式判定

根据需求复杂度选择执行模式，避免小需求被重型流程拖累。

### 模式 A：轻量模式（Lite）

**适用场景**（满足任意一条即可）：
- 文案、字段、提示语的微调
- 单一字段/表单项的增删改
- 配置项类需求（开关、阈值调整）
- 用户主动声明「小改动」「轻量」「快速过一下」
- 改动只涉及 1 个现有页面、且无新增交互流程

**执行阶段**：仅 `阶段零（brainstorming）` + `阶段二（write-prd）`

**跳过**：research、PRD 评审、IxD、review-ixd、prototype、验收 Case

**理由**：小改动可行性显而易见，研发可基于 brainstorming + PRD 直接实现。

### 模式 B：标准模式（Full）

**适用场景**：
- 涉及多页面变更或新增页面
- 引入新的业务流程或状态机
- 需要竞品分析或可行性论证
- 用户未声明轻量、且需求描述跨多个功能点

**执行阶段**：阶段零 ~ 阶段六 全跑

---

## 子任务委派（成本优化）

以下机械性任务**必须**通过 `Agent` 工具委派给 subagent 执行，避免占用主会话上下文：

| 任务 | 委派理由 |
|------|---------|
| 读取并整理 `products/{product}/pages/*.md` 现状文档 | 文档大、格式固定，主会话只需结论摘要 |
| `capture-page` 采集后的 DOM diff 对比 | 输入超长，输出结构化 |
| `review-ixd` 知识库逐条检查 | 重复模式匹配，无需主会话推理 |
| 验收 Case 模板填充（基于 PRD 功能点平铺） | 模板化生成 |
| 竞品资料抓取与摘要（research 阶段） | WebFetch 多页 + 摘要，长输入短输出 |

**不委派**的关键决策（必须主会话保留）：brainstorming 对话、PRD 第八章方案设计、评审阻塞项判定、IxD 关键交互决策、用户交互式确认。

委派时务必在 prompt 中明确：(1) 输入文件路径；(2) 期望输出格式（结构化摘要而非原文）；(3) 字数上限（一般 ≤ 500 字）。

---

## 阶段执行规则

- **阶段零（Brainstorming）是交互式阶段**：通过对话与用户共同探索需求，产出设计文档后等待用户回复「继续」
- **Lite 模式**：Brainstorming 确认后，仅执行阶段二（write-prd），结束。不跑 research/评审/IxD/原型/验收 Case
- **Full 模式 · 阶段一 ~ 阶段六自动串联执行**：Brainstorming 确认后，research → PRD → 评审 → IxD（含 review-ixd）→ 原型 → 验收 Case 设计 全自动依次执行，中间不暂停，最终一次性交付所有产出
- **阶段七（验收执行）不在自动串联中**：因依赖研发部署上线时点，由用户在功能上线后手动触发
- 自动执行过程中如遇到阻断性问题（如调研结论为 NO-GO、评审发现必须解决的阻塞项、改造页面缺少现状文档、PRD 第八章仍是旧版功能点平铺结构），立即暂停并向用户报告，等待决策后再继续
- 「跳过」→ 记录为已跳过，进入下一阶段
- 「从[阶段]重新来」→ 重新执行该阶段（自动读取已有上游文件）
- 中途修改 → 按反馈调整，重新输出结论

| 阶段 | Skill | 产出路径 |
|------|-------|---------|
| 零：需求探索 | `pm-brainstorming` | `workspace/brainstorming/YYYY-MM-DD-{feature}-design.md` |
| 一：需求调研 | `research` | `workspace/research/需求调研_{feature}_{date}.md` |
| 二：PRD 编写 | `write-prd` | `workspace/prd/PRD_{feature}_v0.1.md` |
| 三：需求评审 | `review-prd` | `workspace/prd/评审_{feature}_{date}.md` |
| 四：交互设计 | `ixd` → `review-ixd` | `workspace/ixd/交互设计说明_{feature}_v0.1.md` |
| 五：原型设计 | `prototype` | `workspace/prototype/{feature}/` （HTML 原型）或 Figma |
| 六：验收 Case 设计 | `acceptance`（子流程 A） | `workspace/acceptance/{feature}/验收Case_{feature}_v0.1.md` |
| 七：验收执行（手动） | `acceptance`（子流程 B） | `workspace/acceptance/{feature}/验收报告_{feature}_{date}.html/.md` |

> **阶段零说明**：`pm-brainstorming` 以 PM 视角通过一问一答探索需求边界、用户场景、功能形态和方案取舍，产出设计文档。该文档作为后续所有阶段的上游输入，确保决策上下文不丢失。

> **阶段四说明**：`ixd` 产出后自动触发 `review-ixd` 审查。审查完成且用户决策落地后，`review-ixd` 会自动提取 IxD 中涉及的页面变更，输出 diff 预览供用户确认后更新 `products/<产品>/pages/` 知识库（标记为「设计态」）。

> **阶段五说明**：`prototype` 自动分析 IxD 中的页面类型，走双分支——所有页面统一生成 HTML 原型（基于已采集 DOM 组件库 + IxD 变更描述），保证风格与线上产品一致。纯后端需求自动跳过。

---

## Skill 文件依赖关系

修改任何流程规则时，必须检查本矩阵中的所有关联文件并同步更新。

```
pm-workflow.md (主编排器)
├── README.md              ← 流程描述同步
├── research.md            ← 阶段衔接语
├── write-prd.md           ← 阶段衔接语
├── review-prd.md          ← 阶段衔接语 + 阻断逻辑
├── ixd.md                 ← 阶段衔接语 + 待确认项逻辑
├── skills/review-ixd/     ← IxD 后自动触发
├── skills/prototype/      ← 原型阶段逻辑
├── skills/acceptance/     ← 阶段六（Case 设计，自动接续）+ 阶段七（验收执行，手动触发）
└── CLAUDE.md              ← 工作流说明段落
```

---

## 功能上线后：手动收尾动作

以下两个动作不在主流程自动串联中，由用户在功能上线后按需手动触发：

### 1. 验收执行（阶段七）

```
验收一下
```

触发 `acceptance` 子流程 B，基于阶段六产出的验收 Case 文档，截图并 AI 判定生成验收报告。详见 `acceptance/SKILL.md`。

### 2. 页面知识库同步（线上态）

```
采集页面 auto <产品名> all
```

Playwright 自动采集线上页面 DOM，与现有 pages 文档对比，输出 diff 确认后更新为「线上态」。

---

## 管道收尾

### Lite 模式：阶段二完成后

- 更新 `products/{product}/roadmap.md` 中该 feature 状态 → `🚀 待排期`
- 输出完成总结：

```
🎉 {产品名} · {feature} 设计闭环完成（Lite 模式）

📄 workspace/brainstorming/YYYY-MM-DD-{feature}-design.md
📄 workspace/prd/PRD_{feature}_v0.1.md

下一步：同步研发排期。如需补 IxD/原型/验收 Case，回复「升级到 Full」。
```

### Full 模式：阶段六完成后（自动串联终点）

- 更新 `products/{product}/roadmap.md` 中该 feature 状态 → `🚀 待排期`
- 更新 `products/README.md` 全景表格
- 输出完成总结：

```
🎉 {产品名} · {feature} 设计闭环完成

📄 workspace/brainstorming/YYYY-MM-DD-{feature}-design.md
📄 workspace/research/需求调研_{feature}_{date}.md
📄 workspace/prd/PRD_{feature}_v0.1.md
📄 workspace/prd/评审_{feature}_{date}.md
📄 workspace/ixd/交互设计说明_{feature}_v0.1.md
📄 workspace/prototype/{feature}/...
📄 workspace/acceptance/{feature}/验收Case_{feature}_v0.1.md

下一步：同步研发排期。研发上线后回复「验收一下」启动验收执行。
```

### 阶段七完成后（验收执行终点）

- 更新 `products/{product}/roadmap.md` 中该 feature 状态 → `✅ 已上线`（验收通过时）或保持 `🚀 待排期`（验收不通过时）
- 验收报告归档至 `workspace/acceptance/{feature}/`
