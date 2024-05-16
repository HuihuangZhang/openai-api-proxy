> ⚠️ 这是代理的服务器端，不是客户端。需要部署到可以联通 openai api 的网络环境后访问。

## 特色功能

1. 支持SSE流式输出
1. 内置文本安全审核（需要配置腾讯云KEY）

## NodeJS部署

你可以把 ./app.js 部署到所有支持 nodejs 14+ 的环境，比如云函数和边缘计算平台。

1. 复制 app.js 和 package.json 到目录 
1. yarn install 安装依赖
1. node app.js 启动服务

## Docker部署 

```
docker run -p 9000:9000 easychen/ai.level06.com:latest
```

Proxy地址为 http://${IP}:9000

### 可用环境变量

1. PORT: 服务端口
1. PROXY_KEY: 代理访问KEY，用于限制访问
1. TIMEOUT：请求超时时间，默认30秒
1. TENCENT_CLOUD_SID：腾讯云secret_id
1. TENCENT_CLOUD_SKEY：腾讯云secret_key
1. TENCENT_CLOUD_AP：腾讯云区域（如：ap-singapore 新加坡）

## 接口使用方法

1. 将原来项目中 openai 的请求地址（ 比如 https://api.openai.com ）中的域名变更为本 proxy 的域名/IP（注意带上端口号）
1. 如果设置了PROXY_KEY，在 openai 的 key 后加上 `:<PROXY_KEY>`，如果没有设置，则不需修改
1. moderation：true 开启审核，false 关闭审核
1. moderation_level：high 中断所有审核结果不为 Pass 的句子，low 只中断审核结果为 Block 的句子

## 说明 

1. 只支持 GET 和 POST 方法的接口，不支持文件相关接口
1. ~~当前不支持SSE，因此需要关掉 stream 相关的选项~~ 已支持

## 客户端使用实例

以 `https://www.npmjs.com/package/chatgpt` 为例

```js
chatApi= new gpt.ChatGPTAPI({
    apiKey: 'sk.....:<proxy_key写这里>',
    apiBaseUrl: "http://localhost:9001/v1", // 替换代理域名/IP
});
   
```

## 致谢

1. SSE参考了[chatgpt-api项目相关代码](https://github.com/transitive-bullshit/chatgpt-api/blob/main/src/fetch-sse.ts)
