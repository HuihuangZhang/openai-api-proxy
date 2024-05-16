FROM --platform=$TARGETPLATFORM node:18-alpine3.15
WORKDIR /data/api

COPY app.js app.js
COPY package.json package.json

RUN npm install -g cnpm --registry=https://registry.npmmirror.com
RUN cnpm i

ENV PORT=9000

EXPOSE 10333
CMD ["node", "app.js"]
