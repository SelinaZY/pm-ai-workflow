---
name: acceptance
description: 功能验收 — 包含两个子流程：A 设计验收 Case（IxD/原型完成后）、B 执行验收（研发上线后截图判定生成报告）。用户说「写验收 case / 设计验收用例 / 补 case」走 A；说「功能验收 / 验收 / 验收一下 / acceptance」走 B。
---

# 功能验收

本 SKILL 包含两个子流程，触发后**第一步必须先识别走哪个分支**：

| 触发词 | 子流程 | 时机 |
|--------|--------|------|
| 「写验收 case」「生成 acceptance case」「设计验收用例」「补 case」 | **A · Case 设计** | IxD / 原型完成后，研发开发前 |
| 「功能验收」「验收」「验收一下」「acceptance」 | **B · 验收执行** | 研发部署上线后 |

**子流程 B 启动前必须检查**：`workspace/acceptance/{feature}/验收Case_*.md` 是否存在。若不存在，提示用户先跑子流程 A，得到 Case 文档后再执行验收。

---

# 子流程 A：验收 Case 设计

## A.1 强制前置

开始设计前**必须**读 `.claude/skills/acceptance/case-design-checklist.md`，按其中三维 checklist（攻击性视角 / 环境前置 / 反馈回写）逐项推演。**不得**直接 1:1 翻译 PRD 第八章验收标准为 Case。

## A.2 输入收集

1. 自动查找 `workspace/prd/` 下对应 feature 的 PRD 文件（取最新版本）
2. 自动查找 `workspace/ixd/` 下对应 feature 的 IxD 文件
3. 提取 PRD 第八章验收标准全部条目（功能验收 + 性能验收）
4. **自动编号**：若 PRD 表格中没有 AC-xx / PF-xx 编号，按出现顺序自动分配（AC-01、AC-02... / PF-01、PF-02...），后续全流程使用该编号引用
5. 检查 PRD 第八章是否为「用户场景视角」结构（8.1 用户场景 / 8.2 跨场景对比 / 8.3 通用规则 / 8.4 性能）。若仍是旧版「功能点平铺」，**暂停并提示用户回到 review-prd 重构第八章**
6. 检索同类功能历史验收报告（`workspace/acceptance/*/验收报告_*.md`），提取曾经的 ❌ / ⚠️ / 「样本不足」类盲区作为本期回写素材

## A.3 推演与产出

按 case-design-checklist 三维逐项展开，确保：

- 每条 PRD AC ≥ 2 条 Case（正向 + 边界/异常）
- 至少有 1 条「攻击性 Case」覆盖高风险误操作或数据丢失场景
- 每条 Case 标注所需测试样本 + 样本降级方案
- Case 编号与 PRD AC 编号明确关联可追溯

产出文档：

```
workspace/acceptance/{feature}/验收Case_{feature}_v0.1.md
```

## A.4 输出衔接

```
✅ 验收 Case 设计完成：{feature}
📄 workspace/acceptance/{feature}/验收Case_{feature}_v0.1.md

共 [N] 条 Case，关联 [M] 条 AC / [K] 条 PF。
  攻击性 Case：[N] 条
  需特殊样本前置的 Case：[N] 条

下一步：研发实现并部署上线后，回复「验收一下」启动子流程 B。
```

---

# 子流程 B：验收执行

## B.1 启动前检查

1. 确认 `workspace/acceptance/{feature}/验收Case_*.md` 存在；不存在则提示先跑子流程 A
2. 读取 Case 文档与对应 PRD、IxD
3. 对每条 Case 分类：

| 类型 | 判定依据 | 验证方式 |
|------|---------|---------|
| 页面可验 | Case 涉及 UI 元素、布局、按钮状态、文案展示 | 截图 + AI 判定 |
| 交互可验 | Case 涉及操作后的页面变化、弹窗、跳转 | Playwright 操作 + 截图 + AI 判定 |
| 非 UI 类 | Case 涉及后端逻辑、API 响应、数据正确性、性能指标 | 标记为「需人工确认」 |

4. 输出验收计划：

```
🔍 功能验收：{feature}
📄 关联 Case：{Case 路径}
📄 关联 PRD：{PRD 路径}
📐 关联 IxD：{IxD 路径}

共 [N] 条 Case：
  🤖 可自动验证：[N] 条（截图 + AI 判定）
  👤 需人工确认：[N] 条（非 UI 类）

涉及页面：[页面列表]

需你确认的条目（非 UI 类，无法截图验证）：
  AC-xx [验收项名称] — [标准摘要]
  PF-xx [验收项名称] — [标准摘要]
  ...

请提供产品访问地址（或回复「用已有配置」使用 capture-routes.json 中的路由）。
收到地址后，我会先自动截图验证可自动验证的条目，再逐条向你确认非 UI 类条目。
```

## B.2 截图采集

收到产品地址后，运行截图脚本：

**若使用路由配置**：
```bash
node .claude/skills/acceptance/scripts/acceptance-capture.mjs "<产品名>" "<页面列表|all>" "workspace/acceptance/{feature}/screenshots"
```

**若使用 URL**：
```bash
node .claude/skills/acceptance/scripts/acceptance-capture.mjs "<URL>" "<页面名>" "workspace/acceptance/{feature}/screenshots"
```

脚本会为每个页面生成两张截图：
- `{页面名}.png` — 视口截图（1440×900）
- `{页面名}-full.png` — 全页截图

**若脚本失败**：输出错误信息，建议用户改用手动提供截图（截图放入 `workspace/acceptance/{feature}/screenshots/` 目录）。

## B.3 自动验证

逐条处理 Case：

**可自动验证的 Case**：
1. 读取对应页面截图
2. 对照 Case 预期结果 + PRD 验收标准 + IxD 设计逐点比对
3. 自行判定：✅ 通过 / ❌ 不通过 / ⚠️ 部分通过
4. 记录判定依据（"截图中可见 XX 按钮位于工具栏右侧，符合 IxD 设计"）

**需交互验证的 Case**：
1. 根据 IxD/Case 中操作路径拆解为多个步骤
2. 通过 Playwright 逐步执行，**每个关键状态变化后截图**，保存为 `{页面名}-{步骤序号}-{操作描述}.png`
3. 综合多张截图对照预期结果判定

**非 UI 类 Case**：逐条询问用户实际表现：
```
👤 AC-xx：[验收项名称]
标准：[Case 预期结果]
此条目无法通过截图自动验证，请告知实际表现：
```

## B.4 生成验收报告

所有条目验证完毕后，生成 HTML + Markdown 双版本报告：

```
workspace/acceptance/{feature}/验收报告_{feature}_{YYYY-MM-DD}.html  （推荐浏览器查看）
workspace/acceptance/{feature}/验收报告_{feature}_{YYYY-MM-DD}.md   （便于版本管理）
```

## B.5 输出摘要

```
✅ 功能验收完成：{feature}
📄 workspace/acceptance/{feature}/验收报告_{feature}_{date}.html
📄 workspace/acceptance/{feature}/验收报告_{feature}_{date}.md

验收结果：
  ✅ 通过：[N] 条
  ❌ 不通过：[N] 条
  ⚠️ 部分通过：[N] 条

验收结论：[✅ 验收通过 / ⚠️ 有条件通过 / ❌ 验收不通过]

[若有不通过或部分通过]
待跟进项：
1. AC-xx [验收项] — [问题摘要] — 严重程度：[高/中/低]
2. ...

如需调整任何判定结果，请回复「AC-xx 改为 通过/不通过」。
```

用户可逐条覆盖 AI 判定结果，覆盖后重新生成报告。

## B.6 反馈回写（验收完成后）

若本次验收暴露了 Case 未覆盖的盲区：
- 属于**场景/对比类盲区** → 回写到 PRD 第八章，触发 review-prd 改进
- 属于**环境/攻击性/历史类盲区** → 补充到 `case-design-checklist.md` 对应维度

---

# 共享规则（A、B 子流程均适用）

## AC / PF 编号体系

- 功能验收：AC-01、AC-02 ...（按用户场景视角分组时可用 AC-A1 / AC-X1 / AC-G1）
- 性能验收：PF-01、PF-02 ...
- Case 编号必须与 AC/PF 编号显式关联，全流程统一引用

## 严重程度判定规则

| 严重程度 | 判定标准 |
|---------|---------|
| 高 | 核心功能不可用、数据错误、安全漏洞 |
| 中 | 功能可用但体验不符合预期、边界场景处理不当 |
| 低 | 文案/格式/样式等细节偏差，不影响功能使用 |

## 验收结论判定规则

| 条件 | 结论 |
|------|------|
| 所有 Case 通过 | ✅ 验收通过，可上线 |
| 通过率 ≥ 80% 且无「高」严重程度问题 | ⚠️ 有条件通过，需跟进 [N] 项问题后上线 |
| 通过率 < 80% 或存在「高」严重程度问题 | ❌ 验收不通过，需返工后重新验收 |

## Feature 专用脚本目录约定

验收过程中若需为特定 feature 编写 Playwright 交互脚本（多步操作、下载监听、状态等待等无法用通用截图脚本覆盖的场景），统一放到：

```
workspace/acceptance/{feature}/scripts/
```

**命名规则**：

| 脚本类型 | 命名格式 | 示例 | 是否保留 |
|---------|---------|------|---------|
| 最终验证脚本 | `verify-{AC编号}-{简述}.mjs` | `verify-ac02-ac03-ac06.mjs`、`verify-ac07-sync-download.mjs` | ✅ 保留入库 |
| 调试/探索脚本 | 放入 `scripts/_debug/` 子目录 | `_debug/inspect-projects.mjs` | ❌ 验收完成后清理 |

**强制要求**：
- 一个最终脚本必须明确对应一条或多条 AC，命名带 AC 编号便于追溯
- 禁止按"动作阶段"拆分最终脚本（如 `create-and-run.mjs` / `wait-and-capture.mjs` / `final-capture.mjs` 这种命名属于过程产物，应合并为 `verify-{AC}-*.mjs` 或归入 `_debug/`）
- 验收报告生成后必须清理 `_debug/` 目录及无 AC 编号的中间脚本
- 项目根 `.gitignore` 应添加 `workspace/acceptance/*/scripts/_debug/`

## 纯后端 / MCP 类需求

若 IxD 标注「本需求不涉及页面变更」或所有 Case 均为非 UI 类：
- 子流程 A：仍需输出 Case 文档，每条 Case 标注「人工确认」+ 验证步骤说明
- 子流程 B：跳过截图采集，直接进入逐条人工确认模式，最后生成报告

---

## HTML 报告模板

生成的 HTML 报告必须包含以下结构，确保在浏览器中清晰易读：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>功能验收报告：{feature}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 960px; margin: 0 auto; padding: 24px; color: #1a1a1a; background: #fafafa; }
    h1 { font-size: 24px; border-bottom: 2px solid #e5e5e5; padding-bottom: 12px; }
    h2 { font-size: 18px; margin-top: 32px; color: #333; }

    .meta { color: #666; font-size: 14px; margin-bottom: 24px; }
    .meta span { margin-right: 24px; }

    .summary { display: flex; gap: 16px; margin: 24px 0; }
    .summary-card { flex: 1; padding: 16px; border-radius: 8px; text-align: center; }
    .summary-card .count { font-size: 32px; font-weight: bold; }
    .summary-card .label { font-size: 14px; color: #666; margin-top: 4px; }
    .card-pass { background: #f0fdf4; border: 1px solid #bbf7d0; }
    .card-pass .count { color: #16a34a; }
    .card-fail { background: #fef2f2; border: 1px solid #fecaca; }
    .card-fail .count { color: #dc2626; }
    .card-partial { background: #fffbeb; border: 1px solid #fde68a; }
    .card-partial .count { color: #d97706; }

    .verdict { padding: 16px 20px; border-radius: 8px; font-size: 16px; font-weight: 600; margin: 24px 0; }
    .verdict-pass { background: #f0fdf4; border-left: 4px solid #16a34a; color: #16a34a; }
    .verdict-fail { background: #fef2f2; border-left: 4px solid #dc2626; color: #dc2626; }
    .verdict-conditional { background: #fffbeb; border-left: 4px solid #d97706; color: #d97706; }

    .ac-item { background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; margin: 16px 0; padding: 20px; }
    .ac-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .ac-id { font-weight: 700; font-size: 14px; color: #666; }
    .badge { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .badge-pass { background: #dcfce7; color: #16a34a; }
    .badge-fail { background: #fee2e2; color: #dc2626; }
    .badge-partial { background: #fef3c7; color: #d97706; }
    .badge-severity-high { background: #fee2e2; color: #dc2626; }
    .badge-severity-mid { background: #fef3c7; color: #d97706; }
    .badge-severity-low { background: #e0e7ff; color: #4f46e5; }
    .ac-title { font-weight: 600; font-size: 16px; }
    .ac-standard { color: #666; font-size: 14px; margin-bottom: 12px; padding: 8px 12px; background: #f9fafb; border-radius: 4px; }
    .ac-analysis { font-size: 14px; line-height: 1.6; }

    .screenshot { margin: 12px 0; }
    .screenshot img { max-width: 100%; border: 1px solid #e5e5e5; border-radius: 4px; cursor: pointer; }
    .screenshot img:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .screenshot-label { font-size: 12px; color: #999; margin-top: 4px; }

    .followup { background: #fff; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 8px 0; }
    .followup-header { font-weight: 600; color: #dc2626; margin-bottom: 8px; }
  </style>
</head>
<body>
  <h1>功能验收报告：{feature}</h1>
  <div class="meta">
    <span>验收日期：{date}</span>
    <span>关联 PRD：{prd_path}</span>
    <span>关联 Case：{case_path}</span>
  </div>

  <div class="summary">
    <div class="summary-card card-pass"><div class="count">{pass_count}</div><div class="label">通过</div></div>
    <div class="summary-card card-fail"><div class="count">{fail_count}</div><div class="label">不通过</div></div>
    <div class="summary-card card-partial"><div class="count">{partial_count}</div><div class="label">部分通过</div></div>
  </div>

  <div class="verdict {verdict_class}">{verdict_text}</div>

  <h2>验收明细</h2>

  <div class="ac-item">
    <div class="ac-header">
      <span class="ac-id">AC-01</span>
      <span class="badge badge-pass">✅ 通过</span>
      <span class="ac-title">{验收项名称}</span>
    </div>
    <div class="ac-standard">标准：{Case 预期结果}</div>
    <div class="screenshot">
      <img src="screenshots/{page}.png" alt="{page} 截图" onclick="window.open(this.src)">
      <div class="screenshot-label">{page} 页面截图</div>
    </div>
    <div class="ac-analysis">
      <strong>判定依据：</strong>{AI 的分析说明}
    </div>
  </div>

  <div class="ac-item">
    <div class="ac-header">
      <span class="ac-id">AC-02</span>
      <span class="badge badge-fail">❌ 不通过</span>
      <span class="badge badge-severity-high">严重程度：高</span>
      <span class="ac-title">{验收项名称}</span>
    </div>
    <div class="ac-standard">标准：{Case 预期结果}</div>
    <div class="screenshot">
      <img src="screenshots/{page}.png" alt="{page} 截图" onclick="window.open(this.src)">
    </div>
    <div class="ac-analysis">
      <strong>判定依据：</strong>{AI 的分析说明}<br>
      <strong>预期：</strong>{应该是什么样}<br>
      <strong>实际：</strong>{截图中看到什么}
    </div>
  </div>

  <h2>待跟进项</h2>
  <div class="followup">
    <div class="followup-header">AC-02 {验收项名称}</div>
    问题：{偏差描述}<br>
    严重程度：{高/中/低}<br>
    建议：{修复建议}
  </div>
</body>
</html>
```

**模板使用说明**：
- 生成时用实际数据填充占位符
- 截图使用相对路径引用（`screenshots/xxx.png`），报告和截图在同一父目录下
- 点击截图可放大查看原图
- 汇总卡片用颜色区分通过/不通过/部分通过

ARGUMENTS: $ARGUMENTS
