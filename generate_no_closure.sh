#!/bin/bash

awk -v provide=0 '
{
  if (/^goog.provide/) {
    if (!provide) {
      provide = 1;
      print "var yc = window.yc = window.yc || {};";
      print "yc.throttledHttp = yc.throttledHttp || {};";
    }
    print "// " $0;

  } else {
    print;
  }
}
' throttled_http.js > throttled_http_no_closure.js
