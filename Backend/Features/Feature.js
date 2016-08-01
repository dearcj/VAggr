"use strict";
var BTD = require('../BTreeDictionary/BTDictionary');
var _ = require("underscore");
var DOMObject = (function () {
    function DOMObject() {
    }
    return DOMObject;
}());
var Feature = (function () {
    function Feature(queryFunction, dbField) {
        this.qf = queryFunction;
        this.dbField = dbField;
    }
    Feature.prototype.initDictionary = function (cb) {
        var self = this;
        this.dict = new BTD.BTDictionary();
        if (this.dbField)
            this.qf('SELECT * FROM features f where f.name = $1', [this.dbField], function (err, res) {
                if (!err) {
                    if (res[0].dictionary)
                        self.dict.load(res[0].dictionary);
                    cb();
                }
            });
    };
    Feature.prototype.updateDictionary = function () {
        if (this.dbField) {
            var dict = this.dict.save();
            this.qf('UPDATE features SET dictionary = ($1) where name = $2', [dict, this.dbField], function (err, res) {
                if (!err) {
                }
            });
        }
    };
    Feature.prototype.analyzeList = function (l) {
        var i = 0;
        var self = this;
        _.each(l, function (x) {
            i += self.analyzeDOMElem(x).information;
        }.bind(this));
        var avg = i / l.length;
        return { information: avg };
    };
    Feature.prototype.analyzeDOMElem = function (e) {
        return null;
    };
    return Feature;
}());
exports.Feature = Feature;
//# sourceMappingURL=Feature.js.map