const express = require('express')
const path = require('path')
const PORT = process.env.PORT || 5000
const line = require('@line/bot-sdk');
const axios = require('axios');
const request = require('request');

const LINE_CHANNEL_ACCESS_TOKEN = '3xoDGJ8KgOVxVsyS4/XJwYqXOemYOX2b3mDioaOgnMv2jc2vkZcuGBnSzrehcK+sYXWEXgwraDP4DDvm6uiez8PChvb77gEAAtndU93wGwLN+LnsqVlLnQQN8ybt6wIquvnU/xFiobFIY5IOFLjclQdB04t89/1O/w1cDnyilFU=';    // LINE Botのアクセストークン
const LINE_CHANNEL_SECRET = '8df5f91ca99d59fdf5be9877edb547a6';          // LINE BotのChannel Secret

const LINE_MESSAGE_MAX_LENGTH = 2000;

const NEW_LINE = '\n';

const config = {
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

express()
  .use(express.static(path.join(__dirname, 'public')))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/', (req, res) => res.render('pages/index'))
  .get('/g/',(req,res) => res.json({method:"こんにちはgetさん"}))
  .post('/p/',(req,res) => res.json({method:"こんにちはpostさん"}))
  .post('/hook/',line.middleware(config),(req,res) => {
    res.sendStatus(200);
    Promise
      .all(req.body.events.map(handleEvent))
      .then((result)=>{
        console.log('event processed');
      });
  })
  .listen(PORT, () => console.log(`Listening on ${ PORT }`))

const handleEvent = (event) => {
  console.log('handleEvent()');

  if(event.type !== 'message'){
    return Promise.resolve(null);
  }

  if(event.message.type !== 'text'){
    return Promise.resolve(null);
  }

  let message = '';

  const text = (event.message.type === 'text') ? event.message.text : '';
  if(text === '天気'){
    checkWeatherForecast(event.source.userId);
    message = 'ちょっと待ってね';
  }else if(text.endsWith('を調べて')){
    const length = 'を調べて'.length;
    const word = text.slice(0,-length);
    lookUpWords(event.source.userId,word);
    message = 'ちょっと待ってね';
  }else{
    message = text;
  }

  return client.replyMessage(event.replyToken,{
    type:'text',
    text:message
  });
}

const checkWeatherForecast = async (userId) => {
  console.log('checkWeatherForecast()');

  const city = '230010';
  const url = 'http://weather.livedoor.com/forecast/webservice/json/v1?city='+city;
  const res = await axios.get(url);
  const item = res.data;

  let message = '';

  const title = item.title;
  message = '[' +title+']'+NEW_LINE;

  const today = item.forecasts[0];
  const tomorrow = item.forecasts[1];
  const dayAfterTomorrow = item.forecasts[2];

  if(today){
    message += today.dateLabel + ' :' + today.telop + NEW_LINE;
  }
  if(tomorrow){
    message += tomorrow.dateLabel + ' :' + tomorrow.telop + NEW_LINE;
  }
  if(dayAfterTomorrow){
    message += dayAfterTomorrow.dateLabel + ' :' + dayAfterTomorrow.telop + NEW_LINE;
  }

  message += NEW_LINE;
  message += item.link;

  await client.pushMessage(userId,{
    type:'text',
    text:message
  });
}

const lookUpWords = async (userId,word) => {
  console.log('lookUpWords()');

  const options = {
    url:'https://ja.wikipedia.org/w/api.php',
    qs:{
      format:'json',
      action:'query',
      redirects:1,
      list:'search',
      srsearch:word,
      srlimit:3,
      prop:'extracts',
      exchars:200,
      explaintext:1
    }
  };

  request(options, function(err,response,result) {
    let message = '';
    if(!err && response.statusCode == 200){
      const json = JSON.parse(result);
      const search = json.query.search;
      const wikiURL = 'https://ja.wikipedia.org/wiki/';

      const mainTitle = '[検索結果]' + NEW_LINE;
      message = mainTitle;

      // オブジェクトのプロパティの値を配列で得る
      Object.keys(search).some( function(key){
        if(key==-1){
          message = 'ごめんなさい.' +NEW_LINE;
          message += '該当ワードはありません.';
          return true;
        }
        const item = search[key];
        if(item.title && item.snippet){
          let itemMessage = '';

          if(message!= mainTitle){
            itemMessage = NEW_LINE;
            itemMessage += NEW_LINE;
          }

          const title = item.title;
          let summary = item.snippet;
          summary = summary.replace(/<span class="searchmatch">/g,'');
          summary = summary.replace(/<\/span>/g,'');

          itemMessage += '◆' + title + 'とは'+NEW_LINE;
          itemMessage += summary + NEW_LINE;
          itemMessage += NEW_LINE;
          itemMessage += encodeURI(wikiURL+title);
          if((message.length+itemMessage.length)>LINE_MESSAGE_MAX_LENGTH){
            return true;
          }
          message += itemMessage;
        }
      });
      if(message == mainTitle){
        message = 'ごめんなさい。'+NEW_LINE;
        message += '該当ワードはありません。';
      }
      console.log('message='+NEW_LINE);
      console.log(message);
    }else{
      message='ごめんなさい。'+NEW_LINE;
      message+='エラーが発生しました。';
      console.log('error!!');
      console.log('err:'+err+',response.statusCode'+response.statusCode);
    }

    client.pushMessage(userId,{
      type:'text',
      text:message
    });
  }).setMaxListener(10);
}

  // const lineBot = (req,res) => {
  //   res.status(200).end();
  //   const events = req.body.events;
  //   // const promises = [];
  //   // for (let i=0,l=events.length;i<l;i++){
  //   //   console.log(events,'@@@');
  //   //   const ev = events[i];
  //   //   promises.push(
  //   //     echoman(ev)
  //   //     );
  //   // }
  //   // Promise.all(promises).then(console.log('pass @@@@'));
  // }

  // const echoman = async (ev) => {
  //   const pro = await client.getProfile(ev.source.userId);
  //   return client.replyMessage(ev.replyToken,{
  //     type:"text",
  //     text:`${pro.displayName}さん、今「${ev.message.text}」って言いました？${ev.message.text.length}文字。メッセージタイプは${ev.message.type}です。`
  //   })
  // }
