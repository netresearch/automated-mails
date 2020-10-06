FROM node:12.18.4-alpine3.12

WORKDIR /app

COPY . /app

RUN yarn

CMD [ "node", "index.js" ]
