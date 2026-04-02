---
id: visualization-frame-summary
structureType: generic
zhName: 框架结构摘要
enName: Frame Structure Summary
zhDescription: 在侧边栏展示框架结构统计摘要，包括节点数、单元数、最大位移、最大反力和最大内力。
enDescription: Shows a sidebar panel with frame statistics including node/element count, max displacement, max reaction, and max force.
triggers: ["摘要", "summary", "统计", "框架", "frame", "节点数", "位移", "反力", "内力"]
stages: ["analysis"]
autoLoadByDefault: true
domain: visualization
---

# 框架结构摘要

自动识别钢框架类结构并在侧边栏展示关键统计摘要：

- 节点总数 / 单元总数
- 当前视图模式与内力指标
- 最大位移（含单位换算）
- 最大支座反力
- 最大内力（轴力/剪力/弯矩，随工具栏选择切换）

适用于含 beam / truss 类单元的框架结构，其他结构类型不显示此面板。
