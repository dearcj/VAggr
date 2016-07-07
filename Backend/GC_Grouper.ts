/**
 * Created by mac-pc on 7/1/16.
 */
"use strict";

declare function require(name:string);
var _ = require("underscore");
var MathUnit = require('./MathUnit.js');
var u = new MathUnit.MathUnit();
var https = require('https');
var http = require('http');
var imagesize = require('imagesize');
var async = require('async');

class ImgObj {
    url: string;
    domObject: DOMObject;
    width: number;
    height: number;
}

interface ModelResult {
    list: Array<DOMObject>;
    head: DOMObject;
    ruleForHead: string;
}

class DOMObject {
    /*
     Don't use this fields in childrenElem. Logic overwritten in childrenElem
     */
    next: DOMObject;
    prev: DOMObject;
    depth: number;
    maxDepth: number;
    childrenElem: Array<DOMObject>;
    nextElem: DOMObject;
    prevElem: DOMObject;

    parent: DOMObject;
    name: string;
    children: Array<DOMObject>;
    attribs: Array<string>;
}

class GcConsts {
    NULL_ELEMENT_NEGATIVE: number = -1000;
    MAX_HEAVY_COMPARSION: number = 3;
    COMPARSION_THRESHOLD = 500;

}

export class GcGrouper extends GcConsts {
    heavyAttribs: Array<string> = ['style', 'class'];
    $; //cheerio jquery Object
    constructor($) {
        super();
        this.$ = $;
    }

    //call function func for every tree node
    traverse(o: DOMObject, func:Function): void {
        var count = o.childrenElem.length;
        for (var i = 0; i < count; ++i) {
            func.call(this, i, o[i]);

            this.traverse(o[i], func);
        }
    }

    getObjByRule(rule:string, body: DOMObject): DOMObject {
        var ruleArr = rule.split('>');
        if (ruleArr.length == 0) return null;
        var baseElem: DOMObject;
        var startInx: number = 0;
        if (ruleArr[0].charAt(0) == '#') {
            baseElem = this.$(ruleArr[0])[0];
            if (!baseElem) return null;
            startInx = 1;
        } else {
            baseElem = body;
        }

        var cnt = ruleArr.length;
        for (var i = startInx; i < cnt; ++i) {
            var inx: number = parseInt(ruleArr[i]);
            if (baseElem.childrenElem.length <= inx) return null;
            baseElem = baseElem.childrenElem[ruleArr[i]];
        }
        return baseElem;
    }

    collectSameOnThisLevel(pair: Array<DOMObject>, body: DOMObject): Array<DOMObject> {
        var lev = pair[0].depth;
        var sameLev: Array<DOMObject> = [];

        this.traverse(body, function (inx: number, elem: DOMObject) {
            if (elem.depth == lev) {
                if (this.t2tSuperposition(pair[0], elem) > this.COMPARSION_THRESHOLD) {
                    sameLev.push(elem);
                }
            }
        })

        return sameLev;
    }

    getRule(object: DOMObject, body: DOMObject): string {
        var p = object;
        var rootId: string;
        var ruleArr: Array<string> = [];
        while (p != body) {
            if (p.attribs['id']) {
                rootId = p.attribs['id'];
                var xid: string = "#" + rootId;
                ruleArr.unshift(xid);
                break;
            } else {
                //push here inx
                var inx = p.parent.childrenElem.indexOf(p);
                ruleArr.unshift(inx.toString());
                //ruleArr.push();
                object = p;
                p = p.parent;
            }
        }

        return ruleArr.join('>');
    }

    getCommonHead(list: Array<DOMObject>) : DOMObject {
        var list2: Array<DOMObject> = list.slice();
        while (list2.length != 1) {
            var list3: Array<DOMObject> = [];
            for (var i = 0; i < list2.length; ++i) {
                if (list3.indexOf(list2[i].parent) < 0) {
                    list3.push(list2[i].parent);
                }
            }
            list2 = list3;
        }
        return list2[0];
    }


    findModel(body: DOMObject, resCB: Function) {
        this.findImages(body, function (res: Array<ImgObj>) {
            var img = res[0].domObject;
            var par = img.parent;
            while (par && par != body) {

                //console.log(this.isList(par.parent));
                if (par.nextElem) {
                    var comp = this.t2tSuperposition(par, par.nextElem);
                    if (comp > this.COMPARSION_THRESHOLD) {
                        var list: Array<DOMObject> = this.collectSameOnThisLevel([par, par.nextElem]);

                        var h: DOMObject = this.getCommonHead(list);
                        var result: ModelResult = {
                            list: list,
                            head: h,
                            ruleForHead: this.getRule(h)
                        };

                        return result;
                        //OK Possible a list here
                    }
                }
                par = par.parent;
            }
            return null;
        }.bind(this) );
    }

    fastImageSize(url: string, cb: Function) {
        var protocol = null;
        if (url.indexOf('https:') == 0) protocol = https;
        if (url.indexOf('http:') == 0)
            protocol = http;

        url = encodeURI(url);
        if (protocol) {
            var request = protocol.get(url, function (response) {
                imagesize(response, function (err, result) {
                    cb(result);
                    request.abort();
                });
            });
        } else cb(false);
    }

    collectAllImages(body: DOMObject, list: Array<DOMObject>, d) {
        if (!list) list = [];
        var _this = this;
        var funcs = [];
        async.parallel(funcs);

        if (body.children) {
            _.each(body.children, function (el, i) {
                if (el.name == 'img') list.push(el);
                if (el == body)    return;
                if (el.children)
                    _this.collectAllImages(el, list, d + 1);
            })
        }

        //Ok. all images collected lets check img resolution
        return list;
    }

    findImages(body: DOMObject, endCB: Function) {
        var MIN_IMG_WIDTH = 200;
        var MIN_IMG_HEIGHT = 100;

        var imgs = this.collectAllImages(body[0], null, null);
        var results = [];
        var _this = this;
        var funcs = [];

        _.each(imgs, function(x) {
            funcs.push(function (callback) {
                _this.fastImageSize(x.attribs['src'], function end (res) {
                    if (res) {
                        res.domObject = x;
                        res.url = x.attribs['src'];
                        results.push(res);
                    }
                    callback();
                })
            })

        });

        async.parallel(funcs, function done() {
            for (var i = 0; i < results.length; ++i) {
                if (!results[i] || results[i].width < MIN_IMG_WIDTH || results[i].height < MIN_IMG_HEIGHT) {
                    results.splice(i, 1);
                    i--;
                }
            }
            endCB(results);
        });
    }

    t2tSuperposition (tree1: DOMObject, tree2: DOMObject, depth: number) {
        if (!depth) depth = 0;
        var value = 0;
        //lets get away from np full task
        //for each children lets assume that one of children is missed, so lets check children comparsion as Max(A[i], B[i], B[i - 1], B[i + 1])
        var headsComparsion = this.el2elComparsion(tree1, tree2);
        if (headsComparsion < 0) return headsComparsion; else
            value = headsComparsion;
        if (!tree1.children || !tree2.children) return 0;
        for (var i = 0; i < tree1.children.length; ++i) {
            var a = tree1.children[i];
            if (tree2.children.length < i) break;
            var b = tree2.children[i];
            var bNext, bPrev;
            if (i >= 1) bPrev = tree2.children[i - 1];
            if (i < tree2.children.length - 1) bNext = tree2.children[i + 1];

            var argmaxParams = [b];
            if (bPrev) argmaxParams.push(bPrev);
            if (bNext) argmaxParams.push(bNext);

            var argmax = u.argmax(this.el2elComparsion.bind(this, a),
                argmaxParams
            );

            var depthCoef = Math.pow(1.2, 1 + depth);
            if (argmax.value > 0) {
                var res = this.t2tSuperposition(a, argmax.arg, depth + 1);
                if (res > 0)
                    value += res * depthCoef; else value -= depthCoef;
            } else value -= depthCoef;
        }

        return value;
    }

    arrArrSuperposition (arr1: Array<string>, arr2: Array<string>) {
        var sp = 0;
        _.map(arr1, function (arr1Val) {
            if (arr2.indexOf(arr1Val)) sp++;
        });
        return sp;
    }

    heavyAttribComparsion (attrib1: string, attrib2: string) {
        if (attrib1 == attrib2) return this.MAX_HEAVY_COMPARSION;

        var subAttrArray1 = attrib1.split(" ");
        var subAttrArray2 = attrib2.split(" ");
        var superpositionLev = this.arrArrSuperposition(subAttrArray1, subAttrArray2);

        return (superpositionLev / Math.max(subAttrArray1.length, subAttrArray2.length)) * this.MAX_HEAVY_COMPARSION;
    }

    el2elComparsion (el1: DOMObject, el2: DOMObject) {
        if (!el1 || !el2) return this.NULL_ELEMENT_NEGATIVE;
        var comparsionLevel = 0;
        var _this = this;
        if (el1.name == el2.name) {
            comparsionLevel += 1;
            _.each(el1.attribs, function (num, key) {
                if (!el2.attribs[key]) {
                    comparsionLevel--;
                    return;
                }

                if (!el1.attribs[key] || !el2.attribs[key]) {
                    comparsionLevel--;
                    return;
                }

                if (_this.heavyAttribs.indexOf(key.toLowerCase())) {

                    comparsionLevel += _this.heavyAttribComparsion(el1.attribs[key], el2.attribs[key]);
                } else {
                    if (el1.attribs[key] == el2.attribs[key]) {
                        comparsionLevel++;
                    } else
                        comparsionLevel--;
                }
            });
        } else
            comparsionLevel = -5;

        return comparsionLevel;
    }

    /*
     Add depth and maxdepth info to every element
     */
    updateInfoTree (body: DOMObject) {
        if (!body.depth) body.depth = 0;
        if (!body.maxDepth) body.maxDepth = 0;
        var _this = this;
        var maxDepth = 0;
        if (body.children) {
            body.childrenElem = [];

            _.each(body.children, function (elem) {
                if (elem.name) {
                    body.childrenElem.push(elem);
                    if (body.childrenElem.length > 1) {
                        elem.prevElem = body.childrenElem[body.childrenElem.length - 2];
                        body.childrenElem[body.childrenElem.length - 2].nextElem = elem;
                    }
                }
                elem.depth = body.depth + 1;
                _this.updateInfoTree(elem);
                if (elem.maxDepth > maxDepth) maxDepth = elem.maxDepth;
            });


        }

        body.maxDepth += maxDepth + 1;
    }
}
