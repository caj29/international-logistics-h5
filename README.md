# 国际物流助手 - H5 版本

> 国际物流运费计算器，支持 130+ 国家/地区，8种定价模型。

## 本地测试

```bash
# 启动本地服务器
python -m http.server 8080 --directory h5/
# 然后在浏览器打开 http://localhost:8080
```

## 部署到 GitHub Pages

1. 在 GitHub 创建新仓库（如 `international-logistics-h5`）
2. 上传 `h5/` 目录下的所有文件到仓库根目录
3. 在仓库设置中启用 GitHub Pages（选择 `main` 分支）
4. 访问 `https://<你的用户名>.github.io/<仓库名>/`

## 项目结构

```
h5/
├── index.html          # 主页面（SPA 架构）
├── css/style.css      # 样式（v97 设计语言）
├── js/utils.js        # 工具库（8种定价模型）
├── js/app.js          # 主应用逻辑
└── data/
    ├── products.json   # 产品数据（1851条）
    └── countries.json  # 国家列表（248个）
```

## 数据更新

如需更新产品数据：
1. 替换 `data/products.json`（保持格式一致）
2. 如果是 GitHub Pages，提交新文件后自动更新（通常 1-5 分钟内生效）

## 免责声明

本工具提供的运费估算仅供参考，实际费用以物流服务商报价为准。
