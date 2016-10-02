var express = require('express');

var app = express();
// installing handlebars
var handlebars = require('express-handlebars')
  .create({defaultLayout: 'main'});


var fortune = require('./lib/fortune.js');


app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');
app.set('port', process.env.PORT || 3000);

app.use(express.static(__dirname + '/public'));

/*routing*/
app.get('/', function(req, res){
  res.render('home');
});

app.get('/about', function(req, res){
  res.render('about', {fortune: fortune.getFortune()});
});

// 404 page
app.use(function(req, res, next){
  res.status(404);
  res.render('404')
});

// users 500 page
app.use(function(err, req, res, next){
  console.error(err.stack);
  res.status(500);
  res.render('500');
});
/*routing end*/


app.listen(app.get('port'), function(){
  console.log('express is runing on http://localhost:' + app.get('port') + '; press Ctrl+C to stop');
});
