# IDEA 运行环境变量配置

打开 IntelliJ IDEA → Run → Edit Configurations → 找到 LabelHubApplication 启动类，添加以下环境变量：

```
SPRING_DATASOURCE_URL=jdbc:mysql://localhost:3307/labelhub?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true
SPRING_DATASOURCE_USERNAME=root
SPRING_DATASOURCE_PASSWORD=123456
SPRING_DATA_REDIS_HOST=localhost
SPRING_DATA_REDIS_PORT=6379
```

## 当前所有中间件端口一览：
- MySQL → localhost:3307 (密码 123456，库名 labelhub)
- Redis → localhost:6379
- MinIO → localhost:9000 (控制台 http://localhost:9001，账号 minioadmin/minioadmin)
