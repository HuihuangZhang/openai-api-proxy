FROM --platform=$TARGETPLATFORM node:18-alpine3.15
WORKDIR /data/api

COPY app.js app.js
COPY fetchsse.js fetchsse.js
COPY package.json package.json

RUN npm install -g cnpm --registry=https://registry.npmmirror.com
RUN cnpm i

EXPOSE 9000
CMD ["node", "app.js"]
