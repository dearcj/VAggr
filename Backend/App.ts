import {DOMObject} from "./GC_Grouper";
import {GcGrouper} from "./GC_Grouper";
import {ImgObj} from "./GC_Grouper";

declare function require(name:string):any;

var async = require('async');
var _ = require('underscore');
var u = require('./MathUnit.js').MathUnit;

var phantom = require('phantom');
var cheerio = require("cheerio");
var fs = require('fs');
var request = require('requestretry');

export class App {

  scanPages:number = 5;
  images:Array<ImgObj>;
  linkp:string;

  onePageParse(body, $, cb):void {
    var self = this;
    if (!body) {
      console.log('ERROR: NO BODY');
      return;
    }

    var gc_grouper = new GcGrouper($, body, this.linkp);
    gc_grouper.updateInfoTree();
    gc_grouper.findModel(function (res) {
      cb({images: gc_grouper.images, res: res});
    });
  };


  parse(linkp:string, pages:number, cb:Function) {
    var links = [];
    this.linkp = linkp;
    if (~linkp.indexOf(':page')) {
      for (var i:number = 1; i <= pages; ++i) {
        var x = linkp.replace(":page", i.toString());
        links.push(x);
      }
    } else links.push(linkp);

    var self = this;

    u.async(this.loadDynamicPageWithInject, links, function superdone(arrayLoadedPages) {

      u.async(self.onePageParse.bind(self), arrayLoadedPages, function superdone2(everything) {
        cb(everything);
      });

    });
  }

  loadTemplate(url:string, endCB:Function) {
    var $:Function = cheerio.load(fs.readFileSync(url));
    var bod = $('body');
    endCB(bod, $);
  }

  loadStaticPage(url:string, endCB:Function) {
    console.log('loading static page: ' + url);

    request({
      uri: url,
      maxAttempts: 5,   // (default) try 5 times
      retryDelay: 5000,  // (default) wait for 5s before trying again
      retryStrategy: request.RetryStrategies.HTTPOrNetworkError
    }, function (error, response, body) {

      if (error) {
        console.log(error);
        endCB(null, null);
      } else {

        var $:Function = cheerio.load(body);
        var bod = $('body')[0];
        endCB(bod, $);
      }
    });
  }

  /*
   Loading dynamic page and scroll it by 10k pix for infinite scrolls
   */
  loadDynamicPage(url:string, endCB:Function) {
    console.log('loading dynamic page');
    var obj = [];
    var urls = [];

    phantom.create(['--ignore-ssl-errors=yes', '--load-images=no']).then(function (ph:any) {
      var pg = ph.createPage();

      return pg.then(function (page:any) {

        page.property('viewportSize', {width: 1024, height: 768}).then(function () {
          page.property('customHeaders', {}).then(
            function () {
              page.property('customHeaders', {
                'Host': 'localhost:1337',
                'Connection': 'keep-alive',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.95 Safari/537.36',
                'Accept-Encoding': 'gzip, deflate, sdch',
                'Accept-Language': 'en-US,en;q=0.8,ru;q=0.6'
              }).then(function () {

                page.on('onResourceRequested', function (requestData, networkRequest, obj) {
                  urls.push(requestData.url); // this would push the url into the urls array above

                  console.log('Request ' + JSON.stringify(requestData, undefined, 4));
                }, obj);

                page.open(url).then(function (status) {
                  //console.log(page.content);
                  page.evaluate(function () {
                    window.scrollBy(0, 10000);
                    return window.pageYOffset;
                  }).then(function (r) {
                    var x = page.property('content').then(function (content) {
                      var $:Function = cheerio.load(content);
                      var bod = $('body');
                      endCB(bod[0]);
                    });
                  });
                });
              });
            }
          );
        });
      });
    });
  }

  loadDynamicPageWithInject(url:string, endCB:Function) {
    console.log('loading dynamic page with polyfill');
    var pages = 3;
    var obj = [];
    var urls = [];
    var pg = null, ph = null;

    var loadNewPage = function (x) {
      return pg.evaluate(function (offs) {
        window.scrollBy(0, offs);
        return window.pageYOffset;

      }, x)
    };

    var retrieveContent = function () {
      pg.property('content').then(function (content) {
        console.log(content.length);
        var $ = cheerio.load(content, {normalizeWhitespaces: true, xmlMode: true});
        var body = $('body');

        endCB(body[0], $);
        pg.close();
        ph.exit();
      });
    }

    phantom.create(['--ignore-ssl-errors=yes', '--load-images=no'])//, '--proxy=127.0.0.1:8888'])
      .then(function (instance) {
        ph = instance;
        return ph.createPage();
      })
      .then(function (page) {
        pg = page;
        return pg.property('viewportSize', {width: 1024, height: 768});
      })
      .then(function () {
        return pg.setting('userAgent', 'Mozilla/5.0 (Windows; U; Windows NT 6.1; en-US; rv:1.9.1b2) Gecko/20081201 Firefox/3.1b2')
      })
      .then(function () {
        return pg.property('customHeaders', {
          "Accept-Language": "en-US,en;q=0.5"
        });
      })
      .then(function () {
        return pg.on('onResourceRequested', false, function (requestData, networkRequest) {
          urls.push(requestData.url); // this would push the url into the urls array above
        });
      })
      .then(function () {
        return pg.on('onInitialized', true, function () {
          this.injectJs('./helpers/phantom/polyfill.js');

        });
      })
      .then(function () {
        return pg.open(url);
      })
      .then(function (status) {
          if (status) {
            setTimeout(function () {
              //BASIC STUFF LOADED
              for (var i = 0; i < pages; ++i) {
                setTimeout(loadNewPage.bind(this, i * 2000), i * 2000);
              }

              setTimeout(retrieveContent, i * 2000);
            }, 500);
          } else {
      pg.close();
      ph.exit();
      endCB();
          }

  }
      ).catch(
      function (error) {
        console.log(error);

        pg.close();
        ph.exit();
        endCB();
      }
    )

  }

}
