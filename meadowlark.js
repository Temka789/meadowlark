var express = require('express');
var formidable = require('formidable');
var app = express();

switch (app.get('env')){
  case 'development':
    // сжатое многоцветное журналирование для
    // разработки
    app.use(require('morgan')('dev'));
    break;
  case 'production':
    // модуль 'express-logger' поддерживает ежедневное
    // чередование файлов журналов
    app.use(require('express-logger')({
      path: __dirname + '/log/requests.log'
    }));
    break;
}

app.use(function(req,res,next){
  var cluster = require('cluster');
  // console.log(cluster);
  if(cluster.isWorker) console.log('Исполнитель %d получил запрос', cluster.worker.id);
  next();
});

// installing handlebars
var handlebars = require('express-handlebars').create({
    defaultLayout: 'main',
    helpers: {
      section: function(name, options){
        if(!this._sections) this._sections = {};
        this._sections[name] = options.fn(this);
        return null;
      }
    }
  });

var fortune = require('./lib/fortune.js');
var weather = require('./lib/weather.js');

var jqupload = require('jquery-file-upload-middleware');
var credentials = require('./credentials');
app.use(require('cookie-parser')(credentials.cookieSecret));
app.use(require('express-session')({
  resave: false,
  saveUninitialized: false,
  secret: credentials.cookieSecret
}));

var VALID_EMAIL_REGEX = new RegExp('^[a-zA-Z0-9.!#$%&\'*+\/=?^_`{|}~-]+@' +
  '[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?' +
  '(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$');

var emailService = require('./lib/ema' +
  'il.js')(credentials);
// emailService.send('jeostcustomer@gmail.com', 'Сегодня распродажа туров по реке Худ!', 'Налетайте на них, пока не остыли!');


app.use(function(req,res,next){
  // если имеется экстренное сообщение, переместим его в контекст, а затем удалим
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});


app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');
app.set('port', process.env.PORT || 3000);

app.use(express.static(__dirname + '/public'));

// разбор закодированного тела ($_POST)
app.use(require('body-parser'). urlencoded({ extended: true }));

// adding test software
app.use(function(req, res, next){
  res.locals.showTests = app.get('env') !== 'production' && req.query.test === '1';
  next();
});

app.use(function(req, res, next){
  if(!res.locals.partials) res.locals.partials = {};
  res.locals.partials.weatherContext = weather.getWeather();
  next();
});


app.get('/', function(req, res){
  res.render('home');
});
/* check how sections work */
app.get('/jquery-test', function(req, res){
  res.render('jquery-test');
});
/* check how sections work -end*/


/* adding data from ajax and json in DOM */
app.get('/nursery-rhyme', function(req, res){
  res.render('nursery-rhyme');
});
app.get('/data/nursery-rhyme', function(req, res){
  res.json({
    animal: 'бельчонок',
    bodyPart: 'хвост',
    adjective: 'пушистый',
    noun: 'черт'
  });
});
app.get('/thank-you', function(req, res){
  res.render('thank-you');
});
/* adding data from ajax and json in DOM -end*/

/* form */
app.get('/newsletter', function(req, res){
// мы изучим CSRF позже... сейчас мы лишь
// заполняем фиктивное значение
  res.render('newsletter', { csrf: 'CSRF token goes here' });
});

app.post('/process' , function(req, res){
  // not AJAX
  // console.log('Form (from querystring): ' + req.query.form);
  // console.log('CSRF token (from hidden form field): ' + req.body._csrf);
  // console.log('Name (from visible form field): ' + req.body.name);
  // console.log('Email (from visible form field): ' + req.body.email);
  // res.redirect(303, '/thank-you' );

  // AJAX
  if(req.xhr || req.accepts('json,html' )==='json' ){
    // если здесь есть ошибка, то мы должны отправить { error: 'описание ошибки' }
    res.send({ success: true });
  } else {
    // если бы была ошибка, нам нужно было бы перенаправлять на страницу ошибки
    res.redirect(303, '/thank-you' );
  }
});
/* form -end*/



app.get('/about', function(req, res){
  res.render('about', {
    fortune: fortune.getFortune(),
    pageTestScript: '/qa/tests-about.js'
  } );
});

app.get('/tours/hood-river', function(req, res){
  res.render('tours/hood-river');
});
app.get('/tours/request-group-rate', function(req, res){
  res.render('tours/request-group-rate');
});

app.get('/headers', function(req, res){
  res.set('Content-Type', 'text/plain');
  var s = '';
  for(var name in req.headers)
    s += name + ': ' + req.headers[name] + '\n';
  res.send(s)
});


app.get('/contest/vacation-photo', function(req, res){
  var now = new Date();
  res.render('contest/vacation-photo', {
    year: now.getFullYear(),
    month: now.getMonth()
  })
});

app.post('/contest/vacation-photo/:year/:month', function(req, res){
  var form = new formidable.IncomingForm();
  form.parse(req, function(err, fields, files){
    if(err) return res.redirect(303, 'error');
    console.log('received fields:');
    console.log(fields);
    console.log('received files:');
    console.log(files);
    res.redirect(303, '/thank-you')
  })
});

app.use('/upload', function(req, res, next){
  var now = Date.now();
  jqupload.fileHandler({
    uploadDir: function(){
      return __dirname + '/public/uploads/' + now
    },
    uploadUrl: function(){
      return '/uploads/' + now;
    }
  })(req, res, next)
});
// sending a mail
app.post('/cart/checkout', function(req, res){
  var cart = req.session.cart;
  if(!cart) next(new Error('Корзина не существует.'));
  var name = req.body.name || '', email = req.body.email || '';
// Проверка вводимых данных
  if(!email.match(VALID_EMAIL_REGEX))
    return res.next(new Error('Некорректный адрес электронной почты.'));
// Присваиваем случайный идентификатор корзины;
// При обычных условиях мы бы использовали
// здесь идентификатор из БД
  cart.number = Math.random().toString().replace(/^0\.0*/, '');
  cart.billing = {
    name: name,
    email: email
  };
  res.render( 'email/cart-thank-you',
    { layout: null, cart: cart },
    function(err,html){
      if( err ) console.log('ошибка в шаблоне письма');
      mailTransport.sendMail({
        from: '"Meadowlark Travel": info@meadowlarktravel.com',
        to: cart.billing.email,
        subject: 'Спасибо за заказ поездки в Meadowlark',
        html: html,
        generateTextFromHtml: true
    }, function(err){
        if(err) console.error('Не могу отправить подтверждение: ' + err.stack);
      });
    }
  );
  res.render('cart-thank-you', { cart: cart });
});
// sending a mail -end


// 404 page
app.use(function(req, res, next){
  res.status(404);
  res.render('404');
});

// users 500 page
app.use(function(err, req, res, next){
  console.error(err.stack);
  res.status(500);
  res.render('500');
});


function startServer(){
  app.listen(app.get('port'), function(){
    console.log('Express запущено в режиме ' + app.get('env') +
      ' на http://localhost:' + app.get('port') +
      '; нажмите Ctrl+C для завершения.');
  });
}

if(require.main === module){
  // Приложение запускается непосредственно;
  // запускаем сервер приложения
  startServer();
}else{
  // Приложение импортируется как модуль
  // посредством "require":
  // экспортируем функцию для создания сервера
  module.exports = startServer;
}