---
name: build-component-library
description: 从产品已采集的 DOM 文件中提取 UI 组件，建立或增量更新产品组件库（component-library.html）。首次建立时全量提取；后续新增页面 DOM 后增量追加新组件。用户说「建立组件库」「更新组件库」「build component library」时触发。也可由 prototype SKILL 在组件库不存在时自动触发。
---

# 产品组件库构建

## 触发方式

- **手动触发**：用户说「建立组件库」「更新组件库」「build component library」
- **自动触发**：prototype SKILL 发现 `products/<产品名>/component-library.html` 不存在时

## 执行步骤

### Step 1：确认产品和模式

检查 `products/<产品名>/component-library.html` 是否存在：

- **不存在** → 全量模式：扫描所有 DOM 文件，从头建立组件库
- **已存在** → 增量模式：只扫描新增的 DOM 文件，将新组件追加到现有组件库

输出确认：

```
📦 组件库构建

产品：{产品名}
模式：{全量建立 / 增量更新}
DOM 来源：products/{产品名}/pages/dom/（共 N 个文件）
{增量模式时：}上次更新：{日期}，本次新增 DOM：{文件名列表}

确认后开始提取。
```

---

### Step 2：提取组件

读取 `products/<产品名>/pages/dom/` 下的 HTML 文件，按以下分类提取组件片段：

| 分类 | 组件 | 提取要点 |
|------|------|---------|
| 按钮 | 主操作按钮、次操作按钮、危险按钮、禁用态、图标按钮 | 完整 `<button>` 标签含 class |
| 输入框 | 普通输入、带前缀图标、带清除按钮、禁用态 | `<input>` 及外层容器 |
| 下拉选择 | 普通 Select、可搜索 Select、禁用态 | Select 容器及触发元素 |
| 单选/多选 | Radio Group、Checkbox Group | 含 label 的完整结构 |
| 表格 | 表头、数据行、操作列、分页、空状态行 | `<thead>` + 示例 `<tr>` |
| 弹窗 | Modal 容器、标题区、内容区、底部操作区 | 完整 Modal 结构 |
| 标签/徽标 | Tag（各颜色）、Badge、状态标签 | 含颜色 class 的完整标签 |
| 代码框 | 代码编辑器容器、语法高亮区域 | 编辑器外层容器 |
| 导航 | 侧边菜单项、选中态、禁用态、分组标题 | `<li>` 级别的菜单项 |
| 卡片 | Card 容器、标题区、内容区、操作区、hover 态 | 完整 Card 结构 |
| 进度条 | Progress Bar（含百分比） | 进度条容器 |
| 空状态 | Empty 组件、无数据提示 | 完整空状态结构 |
| 全局样式 | CSS 变量、字体、颜色、间距 | `:root` 或 `body` 上的 CSS 变量 |

提取原则：
- **保留完整 HTML 片段**（含 class、data 属性、内联样式），不裁剪
- 每个组件片段附上来源注释：`<!-- 来源：{文件名} -->`
- 同类组件若多个 DOM 文件中都有，取**最完整**的一份，其余标注为备选
- 增量模式下，若新 DOM 中的组件与现有组件库中已有同类组件，只在有**新变体**时追加，不重复

---

### Step 3：写入组件库文件

将提取结果写入 `products/<产品名>/component-library.html`，格式如下：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>{产品名} 组件库</title>
  <meta name="updated" content="{YYYY-MM-DD}">
  <meta name="source-pages" content="{逗号分隔的来源 DOM 文件名}">
  <!-- 注入产品全局 CSS 变量 -->
  <style>
    :root { /* 从 DOM 提取的 CSS 变量 */ }
  </style>
</head>
<body>

<!-- ==================== 按钮 ==================== -->
<section data-component="button">
  <!-- 主操作按钮 | 来源：task-list.md -->
  <button class="ant-btn ant-btn-primary">...</button>
  <!-- 次操作按钮 | 来源：project-list.md -->
  <button class="ant-btn">...</button>
  <!-- 禁用态 | 来源：create-project-modal.md -->
  <button class="ant-btn ant-btn-primary" disabled>...</button>
</section>

<!-- ==================== 输入框 ==================== -->
<section data-component="input">
  ...
</section>

<!-- 其余分类依此类推 -->

</body>
</html>
```

---

### Step 4：输出结果

```
✅ 组件库{建立/更新}完成

📄 products/{产品名}/component-library.html

提取结果：
  ✅ 按钮：N 个变体
  ✅ 输入框：N 个变体
  ✅ 下拉选择：N 个变体
  ...
  ⚠️ 代码框：未找到线上参考（DOM 中无对应组件）

{若有 ⚠️ 项：}
以下组件在已采集 DOM 中未找到，原型生成时将使用 Ant Design 默认样式：
  - {组件名}

组件库已就绪，可运行 /prototype 生成原型。
```

---

## 注意事项

- 组件库文件是**只读参考**，不直接在浏览器中渲染展示，仅供 prototype SKILL 读取使用
- 每次 `/capture-page` 采集新页面后，建议运行一次增量更新，保持组件库与线上同步
- 组件库文件头部的 `source-pages` meta 标签记录了已纳入的 DOM 文件，增量模式依此判断哪些是新文件

ARGUMENTS: $ARGUMENTS
