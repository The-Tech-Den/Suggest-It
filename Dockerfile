FROM node:14
COPY . /bot
WORKDIR /bot
RUN npm i
RUN npm run build
CMD npm start