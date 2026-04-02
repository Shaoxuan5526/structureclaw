---
id: visualization-png-export
structureType: generic
zhName: PNG 导出
enName: PNG Export
zhDescription: 将当前三维结构场景截图并下载为 PNG 文件，文件名自动包含结构标题与工况信息。
enDescription: Captures the current 3D structural scene and downloads it as a PNG file with title and case metadata in the filename.
triggers: ["导出", "export", "PNG", "截图", "screenshot", "保存图片", "下载"]
stages: ["analysis"]
autoLoadByDefault: true
domain: visualization
---

# PNG 导出

将当前三维结构可视化场景一键截图并下载：

- 点击工具栏右侧「导出 PNG」按钮触发
- 自动读取 WebGL Canvas 内容
- 文件名格式：`structureclaw-{结构标题}-{工况ID}.png`
- 支持导出当前所有视图状态（力图、变形图、模型图）
