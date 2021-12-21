FROM node:erbium-alpine

WORKDIR /app

COPY . /app

RUN yarn

EXPOSE 22003

CMD [ "node", "index.js" ]
