"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var _ = require("underscore");
var u = require('./MathUnit.js').MathUnit;
var https = require('https');
var http = require('http');
var imagesize = require('imagesize');
var async = require('async');
var url = require('url');
var ImgObj = (function () {
    function ImgObj() {
    }
    return ImgObj;
}());
exports.ImgObj = ImgObj;
var DOMObject = (function () {
    function DOMObject() {
    }
    return DOMObject;
}());
exports.DOMObject = DOMObject;
var GcConsts = (function () {
    function GcConsts() {
        this.NULL_ELEMENT_NEGATIVE = -1000;
        this.MAX_HEAVY_COMPARSION = 3;
        this.COMPARSION_THRESHOLD = 50;
    }
    return GcConsts;
}());
function traverse(o, func, onlyElements) {
    if (onlyElements === void 0) { onlyElements = true; }
    var arr = o.childrenElem;
    if (!onlyElements) {
        arr = o.children;
    }
    if (!arr)
        return;
    var count = arr.length;
    for (var i = 0; i < count; ++i) {
        if (arr[i]) {
            func.call(this, arr[i], i);
            if (arr[i])
                traverse(arr[i], func);
        }
    }
}
exports.traverse = traverse;
var GcGrouper = (function (_super) {
    __extends(GcGrouper, _super);
    function GcGrouper($, body, linkp) {
        _super.call(this);
        this.heavyAttribs = ['style', 'class'];
        this.body = body;
        this.$ = $;
        this.linkp = linkp;
    }
    //call function func for every tree node
    GcGrouper.getImagesFromObj = function (o) {
        var a = [];
        var imagesRegexp = new RegExp('(https?:\/\/.*\.(?:png|jpg|jpeg))', 'i');
        for (var prop in o.attribs) {
            if (imagesRegexp.test(o.attribs[prop])) {
                a.push(o.attribs[prop]);
            }
        }
        return a;
    };
    GcGrouper.prototype.collectSameOnThisLevel = function (pair) {
        var lev = pair[0].depth;
        var sameLev = [];
        traverse(this.body, function (elem, inx) {
            if (elem.depth == lev) {
                if (this.t2tSuperposition(pair[0], elem) > this.COMPARSION_THRESHOLD) {
                    sameLev.push(elem);
                }
            }
        }.bind(this));
        return sameLev;
    };
    GcGrouper.prototype.getObjByRule = function (rule, head, noText) {
        if (noText === void 0) { noText = true; }
        if (!head)
            head = this.body;
        var childArr = 'children';
        if (noText)
            childArr = 'childrenElem';
        var ruleArr = rule.split('>');
        if (ruleArr.length == 0)
            return null;
        var baseElem;
        var startInx = 0;
        if (ruleArr[0].charAt(0) == '#') {
            baseElem = this.$(ruleArr[0])[0];
            if (!baseElem)
                return null;
            startInx = 1;
        }
        else {
            baseElem = head;
        }
        var cnt = ruleArr.length;
        for (var i = startInx; i < cnt; ++i) {
            var inx = parseInt(ruleArr[i]);
            if (!baseElem[childArr] || baseElem[childArr].length <= inx)
                return null;
            baseElem = baseElem[childArr][ruleArr[i]];
        }
        return baseElem;
    };
    GcGrouper.prototype.getListByRules = function (head, rulesList) {
        var headObj = this.getObjByRule(head, this.body);
        if (!headObj)
            return null;
        var objList = [];
        var cnt = rulesList.length;
        for (var i = 0; i < cnt; ++i) {
            var obj = this.getObjByRule(rulesList[i], headObj);
            if (!obj)
                return null;
            else
                objList.push(obj);
        }
        return objList;
    };
    /*
     finds dom rule from object <head> to obj <object>
     */
    GcGrouper.prototype.getRule = function (object, head, onlyRelative, noText) {
        if (noText === void 0) { noText = true; }
        var p = object;
        var rootId;
        var ruleArr = [];
        if (!head)
            head = this.body;
        while (p != head) {
            if (!onlyRelative && p.attribs && p.attribs['id']) {
                rootId = p.attribs['id'];
                var xid = "#" + rootId;
                ruleArr.unshift(xid);
                break;
            }
            else {
                //push here inx
                if (noText)
                    var inx = p.parent.childrenElem.indexOf(p);
                else
                    var inx = p.parent.children.indexOf(p);
                ruleArr.unshift(inx.toString());
                //ruleArr.push();
                object = p;
                p = p.parent;
            }
        }
        return ruleArr.join('>');
    };
    GcGrouper.prototype.getCommonHead = function (list) {
        var list2 = list.slice();
        while (list2.length != 1) {
            var list3 = [];
            for (var i = 0; i < list2.length; ++i) {
                if (list3.indexOf(list2[i].parent) < 0) {
                    list3.push(list2[i].parent);
                }
            }
            list2 = list3;
        }
        return list2[0];
    };
    GcGrouper.isVisible = function (domo) {
        var s = domo.attribs['style'];
        if (s)
            s = s.replace(/ /g, "");
        if (s && (s.indexOf('visibility:hidden') >= 0 || s.indexOf('display:none') >= 0))
            return false;
        if (domo && domo.parent) {
            return GcGrouper.isVisible(domo.parent);
        }
        return true;
    };
    GcGrouper.prototype.findModel = function (resCB) {
        this.findImages(function (res) {
            this.images = res;
          if (res.length == 0) {
            resCB(null);
            return;
          }
            //use only visible images
            var x = _.filter(res, function (el) {
                return GcGrouper.isVisible(el.domObject); // (el.domObject.attribs['style'].indexOf('visibility: hidden') < 0)
            }.bind(this));
            var self = this;
            if (res.length == 0) {
                resCB(null);
                return;
            }
          var img = x[0].domObject;
            var par = img.parent;
            while (par && par != this.body) {
                //console.log(this.isList(par.parent));
                if (par.nextElem) {
                    var comp = this.t2tSuperposition(par, par.nextElem);
                    console.log(comp);
                    if (comp > this.COMPARSION_THRESHOLD) {
                        var list = this.collectSameOnThisLevel([par, par.nextElem]);
                        var head = this.getCommonHead(list);
                        var rulesList = [];
                        var ruleHead = this.getRule(head);
                        _.each(list, function (y, i) {
                            y.head = head;
                            y.ruleHead = ruleHead;
                            y.grouper = self;
                            y.rule = self.getRule(y, head, true);
                        });
                        resCB(list);
                    }
                }
                par = par.parent;
            }
            resCB(null);
        }.bind(this));
    };
    GcGrouper.prototype.fastImageSize = function (url, cb) {
        u.GET(url, cb, function (req, response) {
            imagesize(response, function (err, result) {
                cb(result);
                req.abort();
            });
        });
    };
    GcGrouper.prototype.collectAllImages = function (list) {
        if (!list)
            list = [];
        var _this = this;
        if (this.body.children) {
            traverse(this.body, function (el) {
                if (el.name == 'img') {
                    var imgs = GcGrouper.getImagesFromObj(el);
                    for (var i = 0, il = imgs.length; i < il; ++i)
                        list.push({ el: el, linkToImage: imgs[i] });
                }
            });
        }
        //Ok. all images collected lets check img resolution
        return list;
    };
    GcGrouper.prototype.findImages = function (endCB) {
        var MIN_IMG_WIDTH = 200;
        var MIN_IMG_HEIGHT = 100;
        var imgs = this.collectAllImages(null);
        var results = [];
        var _this = this;
        var funcs = [];
        var baseLinkObj = url.parse(this.linkp);
        var baseLink = baseLinkObj.protocol + '//' + baseLinkObj.host;
        _.each(imgs, function (x) {
            var u = x.linkToImage;
            var p = url.parse(u);
            if (!p.protocol) {
                u = baseLink + u;
            }
            funcs.push(function (callback) {
                _this.fastImageSize(u, function end(res) {
                    if (res) {
                        res.domObject = x.el;
                        res.url = u;
                        results.push(res);
                    }
                    callback();
                });
            });
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
    };
    GcGrouper.prototype.t2tSuperposition = function (tree1, tree2, depth) {
        if (!depth)
            depth = 0;
        var value = 0;
        //lets get away from np full task
        //for each children lets assume that one of children is missed, so lets check children comparsion as Max(A[i], B[i], B[i - 1], B[i + 1])
        var headsComparsion = this.el2elComparsion(tree1, tree2);
        if (headsComparsion < 0)
            return headsComparsion;
        else
            value = headsComparsion;
        if (!tree1.children || !tree2.children)
            return 0;
        for (var i = 0; i < tree1.children.length; ++i) {
            var a = tree1.children[i];
            if (tree2.children.length < i)
                break;
            var b = tree2.children[i];
            var bNext, bPrev;
            if (i >= 1)
                bPrev = tree2.children[i - 1];
            if (i < tree2.children.length - 1)
                bNext = tree2.children[i + 1];
            var argmaxParams = [b];
            if (bPrev)
                argmaxParams.push(bPrev);
            if (bNext)
                argmaxParams.push(bNext);
            var argmax = u.argmax(this.el2elComparsion.bind(this, a), argmaxParams);
            var depthCoef = Math.pow(1.2, 1 + depth);
            if (argmax.value > 0) {
                var res = this.t2tSuperposition(a, argmax.arg, depth + 1);
                if (res > 0)
                    value += res * depthCoef;
                else
                    value -= depthCoef;
            }
            else
                value -= depthCoef;
        }
        return value;
    };
    GcGrouper.prototype.arrArrSuperposition = function (arr1, arr2) {
        var sp = 0;
        _.map(arr1, function (arr1Val) {
            if (arr2.indexOf(arr1Val))
                sp++;
        });
        return sp;
    };
    GcGrouper.prototype.heavyAttribComparsion = function (attrib1, attrib2) {
        if (attrib1 == attrib2)
            return this.MAX_HEAVY_COMPARSION;
        var subAttrArray1 = attrib1.split(" ");
        var subAttrArray2 = attrib2.split(" ");
        var superpositionLev = this.arrArrSuperposition(subAttrArray1, subAttrArray2);
        return (superpositionLev / Math.max(subAttrArray1.length, subAttrArray2.length)) * this.MAX_HEAVY_COMPARSION;
    };
    GcGrouper.prototype.el2elComparsion = function (el1, el2) {
        if (!el1 || !el2)
            return this.NULL_ELEMENT_NEGATIVE;
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
                }
                else {
                    if (el1.attribs[key] == el2.attribs[key]) {
                        comparsionLevel++;
                    }
                    else
                        comparsionLevel--;
                }
            });
        }
        else
            comparsionLevel = -5;
        return comparsionLevel;
    };
    GcGrouper.updateTextField = function (t) {
        t = t.replace(/\s\s+/g, ' '); //tabs and multiple spaces to space
        t = t.replace(/(\r\n|\n|\r)/gm, ""); //remove enters, breaklines
        t = t.replace(/(\n\t|\n|\t)/gm, ""); //same
        t = t.replace(/\u00a0/g, ""); //same
        t = t.trim();
        return t;
    };
    GcGrouper.prototype.collectTextBelow = function (elem, depth) {
        if (depth < 0)
            return '';
        if (!elem.data)
            elem.data = '';
        var str = '';
        if (elem.children) {
            var chl = elem.children.length;
            for (var i = 0; i < chl; ++i) {
                str += this.collectTextBelow(elem.children[i], depth - 1);
            }
        }
        return elem.data + str;
    };
    /*
     Add depth and maxdepth info to every element
     */
    GcGrouper.prototype.updateInfoTree = function (body) {
        if (body === void 0) { body = null; }
        if (!body)
            body = this.body;
        if (!body.depth)
            body.depth = 0;
        if (!body.maxDepth)
            body.maxDepth = 0;
        var _this = this;
        var maxDepth = 0;
        var maxChildgroup = 6;
        if (body.children) {
            body.childrenElem = [];
            _.each(body.children, function (elem) {
                if (elem.children) {
                    if (!elem.data)
                        elem.data = '';
                    if (elem.children && elem.type != 'text') {
                        elem.data = _this.collectTextBelow(elem, 2);
                    }
                    elem.data = GcGrouper.updateTextField(elem.data);
                    body.childrenElem.push(elem);
                    if (body.childrenElem.length > 1) {
                        elem.prevElem = body.childrenElem[body.childrenElem.length - 2];
                        body.childrenElem[body.childrenElem.length - 2].nextElem = elem;
                    }
                }
                elem.depth = body.depth + 1;
                _this.updateInfoTree(elem);
                if (elem.maxDepth > maxDepth)
                    maxDepth = elem.maxDepth;
            });
        }
        body.maxDepth += maxDepth + 1;
    };
    return GcGrouper;
}(GcConsts));
exports.GcGrouper = GcGrouper;
//# sourceMappingURL=GC_Grouper.js.map
