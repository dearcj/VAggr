import * as BTD from '../BTreeDictionary/BTDictionary';
import {ImgObj} from "../GC_Grouper";
import {Classify} from "../Classify";
declare function require(name:string):any;

var _ = require("underscore");


class DOMObject {
}

class InfValue {
  information:number;
  value:string;
}

export class ClassifyResults {
  information:number;
  rule:string;
  elements:Array<DOMObject>;
}

export abstract class Feature {
  public dict:BTD.BTDictionary;
  public qf:(q:string, params:Array<Object>, cv:Function) => void;
  public images:Array<ImgObj>;
  public classifyResult:ClassifyResults;
  public classify:Classify;
  public dbField:string;
  public lastCalculate: boolean = false;

  initDictionary(cb):void {
    var self = this;
    this.dict = new BTD.BTDictionary();
    if (this.dbField)
      this.qf('SELECT * FROM features f where f.name = $1', [this.dbField], function (err, res) {
        if (!err) {
          if (res[0].dictionary) self.dict.load(res[0].dictionary);
          cb();
        }
      });
  }

  abstract extractValue(e:DOMObject):any;

  textToStringArray(f:string):Array<string> {
    f = f.toLowerCase();
    var sub = [];
    var str = f.slice(0);
    sub.push(str);
    while (str != '') {
      var inx = str.indexOf(" ");
      if (~inx) {
        str = str.substr(inx + 1);
      } else break;
      if (str != '')
        sub.push(str);
    }
    return sub;
  }

  fieldDictIntersection(field:string):InfValue {
    field = field.toLowerCase();

    //field.split(' ');
    var sub = this.textToStringArray(field);
    //vintage tommy hilfiger garbage
    // 1) as is
    // 2) tommy hilfiger garbage
    // 3) hilfiger garbage
    // 4) garbage

    var maxInf = 0;
    var sl = sub.length;
    for (var i = 0; i < sl; ++i) {
      var obj = this.dict.getIntersectionDepth(sub[i]);
      var inf = (obj.count) / field.length;
      if (!obj.prevStrict)
        inf *= 0.15; //penalty for partial word

      maxInf = inf > maxInf ? inf : maxInf;
    }

    return {information: maxInf, value: ''};
  }

  updateDictionary():void {
    if (this.dbField) {
      var dict = this.dict.save();
      this.qf('UPDATE features SET dictionary = ($1) where name = $2', [dict, this.dbField], function (err, res) {
        if (!err) {
        }
      });
    }


  }

  constructor(queryFunction:(q:string, params:Array<Object>, cv:Function) => void, dbField:string, lastCalculate: boolean) {
    this.qf = queryFunction;
    this.dbField = dbField;
    this.lastCalculate = lastCalculate;
  }


  analyzeList(l:Array<DOMObject>):any {
    var i = 0;
    var self = this;
    var density = 0;
    var densityCount = 0;
    _.each(l, function (x) {
      var inf = self.analyzeDOMElem(x).information;
      i += inf;

      if (self.dbField == 'brand' && inf == 1)
        console;
      if (inf > 0.5) {
        density += inf;
        densityCount++;
      }
    }.bind(this));

    var avg = i / l.length;
    if (densityCount == 0) density = 0; else
      density = density / densityCount;

    return {information: avg, density: density};
  }

  analyzeDOMElem(e:DOMObject):any {
    return null;
  }
}
