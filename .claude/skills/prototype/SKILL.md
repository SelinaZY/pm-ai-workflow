---
name: prototype
description: IxD 完成后生成 HTML 可交互原型。所有页面（改造现有或新增）统一生成 HTML，组件样式从产品已采集的 DOM 文件中提取，保证与线上产品风格一致。用户说「生成原型」「做原型」「prototype」时触发。
---

# 原型设计

## 触发方式

- **自动触发**：ixd + review-ixd 完成后，用户回复「是」需要生成原型时
- **手动触发**：用户说「生成原型」「做原型」

---

## 执行步骤

### Step 1：读取 IxD 文档，列出页面清单

读取 IxD 文档（取 `workspace/ixd/` 下最新版本，或用户指定的文件），列出所有需要生成原型的页面，输出确认：

```
📋 本次原型涉及页面：

  - P-01 {页面名}：{一句话说明}
  - P-02 {页面名}：{一句话说明}
  - ...

确认后开始生成，或指出需要调整的地方。
```

---

### Step 2：确定设计参考来源（三级兜底）

按以下优先级确定本次原型照什么风格生成，**命中一级即停**：

**① 线上 DOM 组件库（已有产品的改造/新增页面）**

读取 `products/<产品名>/component-library.html`：
- **若文件存在**：直接加载，作为本次原型的组件参考库，进入 Step 3。
- **若文件不存在但已采集 DOM**：提示用户先运行 `/build-component-library`，或确认后当场一次性提取：
  1. 扫描 `products/<产品名>/pages/dom/` 下所有已采集的 HTML 文件
  2. 提取按钮、输入框、下拉、单选/多选、表格、弹窗、标签、代码框、导航、卡片、进度条、空状态等常用组件片段
  3. 写入 `products/<产品名>/component-library.html` 持久化，后续用 `/build-component-library` 增量追加

**② 产品声明的设计参考（全新产品 / greenfield，无 DOM 可采）**

读 `products/<产品名>.md` 中的 `设计参考:` 字段：
- 若指向某个设计参考库（如 `设计参考: document-canvas`）→ 加载 `.claude/skills/prototype/design-references/<名称>.md`，按其设计语言生成；
- 若产品自带 `products/<产品名>/design-system.md`（产品自有色板/字体/组件规范）→ 加载它；
- 现有设计参考库见 `.claude/skills/prototype/design-references/`（如 `document-canvas` = 桌面文档/画布类工具）。
- **若产品未声明、但需求/IxD 明显属于某已知品类**（如文档编辑器、智能画布）→ 主动建议对应的设计参考并向用户确认后加载。

**③ Ant Design CDN（最后兜底）**

仅当 ①② 都不命中时，才用 Ant Design 默认样式。**注意：Ant Design 是后台管理风格，仅适合 B 端桌面工具型产品；面向阅读/创作的文档、画布、C 端产品不应落到这一档**——遇到这种情况应回到 ② 选/建一个设计参考，避免产出"后台表格味"的粗糙原型。

---

### Step 3：逐页生成 HTML 原型

对每个页面，基于 IxD 文档描述 + Step 2 提取的组件库生成完整 HTML 文件：

#### 生成规则

- 生成完整独立 HTML 文件（包含 `<!DOCTYPE html>`、内联 CSS、完整结构）
- **组件/样式优先级**：① 从 DOM 提取的线上组件片段 → ② 产品声明的设计参考（design-references / design-system）→ ③ Ant Design CDN（最后兜底）。具体见 Step 2。
- 注入产品已有的全局 CSS 变量（从 DOM 文件中提取 `:root` 或 `body` 上的 CSS 变量）
- 对 IxD 中标注为**新增**的元素，加上醒目视觉标记（浅蓝色背景 + 虚线边框），让评审者一眼看出变更范围
- 对 IxD 中标注为**改造**的元素，加上橙色虚线边框标记
- 不需要完整 JavaScript 交互逻辑，但需要实现以下基础交互：
  - 弹窗的打开/关闭
  - Tab 切换
  - 下拉展开/收起
  - 表单字段的显示/隐藏（如迁移类型切换后字段联动）

#### 文件输出路径

```
workspace/prototype/<feature>/<页面名>.html
```

---

### Step 4：启动预览服务器

```bash
.claude/skills/brainstorming/scripts/start-server.sh --project-dir "$(pwd)"
```

将生成的 HTML 文件写入 server 的 content 目录。

**注意**：Windows 环境下需要 `run_in_background: true`。

---

### Step 5：输出并等待反馈

```
✅ 原型已生成

页面列表：
  📄 workspace/prototype/{feature}/{页面名1}.html
  📄 workspace/prototype/{feature}/{页面名2}.html
  ...

🌐 浏览器预览：{server URL}

蓝色虚线 = 新增元素；橙色虚线 = 改造元素。
⚠️ 标注的组件表示未找到线上参考，回退到了设计参考库 / Ant Design 默认样式，需设计师确认。
🎨 本次设计参考来源：{① 线上 DOM｜② 设计参考 <名称>｜③ Ant Design 兜底}

请在浏览器中查看，回复修改意见或「确认」通过。
```

用户反馈后迭代修改，直到用户满意。

---

### Step 6：输出总结

所有页面确认通过后：

```
🎉 原型设计完成

📄 workspace/prototype/{feature}/
  {页面名1}.html
  {页面名2}.html
  ...

回复「继续」进入阶段六：验收 Case 设计。
```

---

## 注意事项

- HTML 原型是**参考原型**，目标是让研发和 PM 看到页面效果，不要求像素级精确
- 新增/改造元素的视觉标记（蓝色/橙色虚线）是原型专属的，不出现在最终产品中
- 组件提取时优先取**完整的 HTML 片段**（含 class、data 属性），而不是只取 class 名，确保样式能正确渲染
- 若 IxD 中某页面的组件在已采集 DOM 中完全找不到对应，在 Step 2 输出时提前告知用户，避免最终原型风格不一致

ARGUMENTS: $ARGUMENTS
