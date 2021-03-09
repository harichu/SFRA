"use strict";

var File = require("dw/io/File");
var Calendar = require("dw/util/Calendar");

exports.getFilesInLocalFolder = function (path, filePattern) {
    var directory = new File(path);
    if (!directory.exists()) {
        return null;
    }
    var regExp = new RegExp(filePattern);
    var files = directory.listFiles(function (file) {
        return file.isFile() && regExp.test(file.name);
    });
    return sortByFiledate(files);
};

function sortByFiledate(files) {
    files.sort(function (a, b) {
        var aFileDate = a.name.replace(".xml", "").split("_").splice(-2).join(" ");
        var bFileDate = b.name.replace(".xml", "").split("_").splice(-2).join(" ");
        var aDate = new Calendar();
        var bDate = new Calendar();
        aDate.parseByFormat(aFileDate, "yyyyMMdd HHmmssSSS");
        bDate.parseByFormat(bFileDate, "yyyyMMdd HHmmssSSS");

        return aDate.compareTo(bDate);
    });
    return files;
}
