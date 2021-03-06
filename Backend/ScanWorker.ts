import {App} from "./App";
import {Classify} from "./Classify";
/**
 * Created by MSI on 28.08.2016.
 */


export class ScanWorker {
  checkInterval:number = 5000;//5 /*mins*/ *60*1000;

  bigScanPages:number = 20;
  scanPages:number = 1;

  featuresLoaded:boolean = false;
  betweenScanDelay:number = 5000;
  app:App;
  classify:Classify;

  bigScanInterval:number = 5 /*days*/ * 24 * 60 * 60 * 1000;
  scanInterval:number = 12 /*hrs*/ * 60 * 60 * 1000;
  qf:(q:string, params:Array<Object>, cv:Function) => void;


  updateLink(link) {

    this.qf('update link set scan_date = $1, big_scan_date = $2  where id = $3 ', [link.scan_date, link.big_scan_date, link.id], function res(e, r) {
    }.bind(this));
  }

  scanLink(link:any) {
    console.log('scanning link', link);
    if (!this.featuresLoaded) return;

    var isBigScan = false;

    if (!link.big_scan_date || link.big_scan_date.getMilliseconds() > new Date().getMilliseconds() - this.bigScanInterval) {
      isBigScan = true;
    }

    var pages = this.scanPages;
    if (isBigScan) {
      pages = this.bigScanPages;
      link.big_scan_date = new Date();
    }
    link.scan_date = new Date();

    pages = 3;
    this.app.scanPages = pages;
    this.app.parse(link.link, pages, function parsed(results) {
      //results[0][0].images
      var alldata = [];
      var images = [];
      for (var i = 0; i < results.length; ++i) {
        if (results[i][0] && results[i][0].res) {
          images = images.concat(results[i][0].images);
          alldata = alldata.concat(results[i][0].res);
        }
      }

      this.classify.link = link.link;
      this.classify.images = images;

      console.log('get elements: ', alldata.length);
      var r = this.classify.analyzeList(alldata);

      this.updateLink(link)
    }.bind(this));
    //scan will be here
  }

  check() {
    this.qf('SELECT *  from link', null, function res(e, r) {
//    this.qf('SELECT *  from link where scan_date is null OR scan_date > $1', [new Date().getMilliseconds() - this.scanInterval], function res(e, r) {
      if (r)
        for (var i = 0, ln = r.length; i < ln; ++i) {
          setTimeout(this.scanLink.bind(this, r[i]), this.betweenScanDelay * i)
        }
    }.bind(this));
  }

  constructor(queryFunction:(q:string, params:Array<Object>, cv:Function) => void, app:App) {
    this.qf = queryFunction;
    this.app = app;
    this.classify = new Classify(queryFunction, null, '');

    this.classify.loadFeatures(function complete() {
      //cl.learnFeature('title', 'abracadabra');
      //   cl.revertHistory(historyId)
//        var x = cl.ft('category').dict.checkWord('blazer');
      this.featuresLoaded = true;
    }.bind(this));


    setTimeout(this.check.bind(this), this.checkInterval);
  }
}
