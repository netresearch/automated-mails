FROM node:12.22.7-alpine3.12

WORKDIR /app

COPY . /app

RUN yarn

EXPOSE 22003

CMD [ "node", "index.js" ]
