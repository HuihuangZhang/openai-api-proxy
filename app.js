const express = require('express')
const fetch = require('cross-fetch')
const multer = require('multer');
const { HttpsProxyAgent } = require('https-proxy-agent');
const cors = require('cors');
const bodyParser = require('body-parser')

const app = express()
const forms = multer({ limits: { fieldSize: 10 * 1024 * 1024 } });

app.use(forms.array());
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

const controller = new AbortController();

app.all(`*`, async (req, res) => {
  console.log('get request model: ', req.body?.model);
  if (req.originalUrl) req.url = req.originalUrl;
  let url = `https://api.openai.com${req.url}`;
  // 从 header 中取得 Authorization': 'Bearer 后的 token
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(403).send('Forbidden');

  const openai_key = token.split(':')[0];
  if (!openai_key) return res.status(403).send('Forbidden');

  const proxy_key = token.split(':')[1] || "";
  console.log("PROXY_KEY:" + proxy_key);
  const validProxyKeys = process.env.PROXY_KEY ? process.env.PROXY_KEY.split(',') : [];
  // 检查传入的proxy_key是否在有效的PROXY_KEY列表中
  if (process.env.PROXY_KEY && !validProxyKeys.includes(proxy_key)) {
    console.log("拒绝访问, PROXY_KEY无效");
    return res.status(403).send('Forbidden');
  }

  const options = {
    method: req.method,
    timeout: process.env.TIMEOUT || 30000,
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': 'Bearer ' + openai_key,
    }
  };

  if (req.method.toLocaleLowerCase() === 'post' && req.body) {
    options.body = JSON.stringify(req.body);
  }

  try {
    // 如果是 chat completion 和 text completion，使用 SSE
    if ((req.url.startsWith('/v1/completions') ||
      req.url.startsWith('/v1/chat/completions')) &&
      req.body.stream) {
      console.log("使用 SSE");
      const response = await myFetch(url, options);
      if (response.ok) {
        // write header
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });
        
        /*
         * 参考：https://web.dev/articles/eventsource-basics#event_stream_format
         * SSE 的数据格式是：
         * ```
         * data: [raw data] \n\n
         * ```
         */
        // 解析 SSE server-side event
        const { createParser } = await import("eventsource-parser");
        const parser = createParser((event) => {
          if (event.type === "event") {
            const data = event.data;
            /*
             * '[DONE]' 是 [openai-node](https://github.com/openai/openai-node) 的结束语规范，并不是 SSE 的规范
             * 最后一句是 
             * ```
             * data: [DONE]\n\n
             * ```
             */
            if (data === '[DONE]') {
              res.end("data: [DONE]\n\n");
            } else {
              res.write("data: " + data + "\n\n");
            }
          }
        });

        if (!response.body.getReader) {
          const body = response.body;
          if (!body.on || !body.read) {
            throw new error('unsupported "fetch" implementation');
          }
          body.on("readable", () => {
            let chunk;
            while (null !== (chunk = body.read())) {
              parser.feed(chunk.toString());
            }
          });
        } else {
          for await (const chunk of streamAsyncIterable(response.body)) {
            const str = new TextDecoder().decode(chunk);
            parser.feed(str);
          }
        }
      } else {
        const body = await response.text();
        res.status(response.status).send(body);
      }
    }
    // else {
    //   console.log("使用 fetch");
    //   const response = await myFetch(url, options);
    //   // 检查返回的内容类型
    //   const contentType = response.headers.get("Content-Type");
    //   // 根据内容类型处理返回的数据
    //   if (contentType.includes("application/json")) {
    //     // 处理JSON数据
    //     const data = await response.json();
    //     // 返回JSON数据
    //     res.json(data);
    //   } else if (contentType.includes("audio")) {
    //     // 处理Audio数据
    //     const audioBlob = await response.blob();
    //     // 需要设置正确的Content-Type
    //     res.setHeader('Content-Type', 'audio/mpeg');
    //     // 发送音频数据给客户端
    //     const audioStream = audioBlob.stream();
    //     audioStream.pipe(res);
    //   } else {
    //     // 处理其他类型的返回或抛出错误
    //     console.log("返回了未知类型的数据| contentType: ", contentType);
    //     res.status(500).send("返回了未知类型的数据");
    //   }
    // }
  } catch (error) {
    console.error(error);
    res.status(500).json({ "error": error.toString() });
  }
})

async function* streamAsyncIterable(stream) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

const proxyAgent = process.env.HTTP_PROXY ? new HttpsProxyAgent(process.env.HTTP_PROXY) : null;

async function myFetch(url, options) {
  const { timeout, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout || 30000)
  const res = await fetch(url, { ...fetchOptions, signal: controller.signal, agent: proxyAgent });
  clearTimeout(timeoutId);
  return res;
}

// Error handler
app.use(function (err, req, res, next) {
  console.error(err)
  res.status(500).send('Internal Serverless Error')
})

const port = process.env.PORT || 9000;
app.listen(port, () => {
  console.log(`Server start on http://localhost:${port}`);
});
