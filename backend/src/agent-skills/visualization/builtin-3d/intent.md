---
id: visualization-3d-scene
structureType: generic
zhName: 3D 结构可视化
enName: 3D Structural Visualization
zhDescription: 基于 Three.js 的三维结构场景渲染，支持轴力/剪力/弯矩云图、变形动画与节点单元拾取。
enDescription: Three.js-based 3D structural scene with force contours, deformation animation, and node/element picking.
triggers: ["可视化", "visualization", "3D", "三维", "场景", "渲染", "内力图", "变形图", "轴力", "剪力", "弯矩"]
stages: ["analysis"]
autoLoadByDefault: true
domain: visualization
---

# 3D 结构可视化

提供基于 Three.js 的三维结构场景渲染能力：

- 三维节点（球体）与单元（管状体）渲染
- 轴力 / 剪力 / 弯矩云图切换（颜色映射）
- 变形图（比例尺可调）与未变形叠加
- 支持反力视图
- 节点 / 单元点击拾取与详细属性查看
- XY / XZ / YZ 平面自适应切换
- WebGL 不可用时自动降级为 SVG 2D 交互视图
- 荷载箭头（节点力、分布荷载）显示
