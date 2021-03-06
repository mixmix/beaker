'use strict';

var pathUtil = require('path');
var Q = require('q');
var gulp = require('gulp');
var less = require('gulp-less');
var watch = require('gulp-watch');
var batch = require('gulp-batch');
var plumber = require('gulp-plumber');
var jetpack = require('fs-jetpack');

var bundle = require('./bundle');
var generateSpecImportsFile = require('./generate_spec_imports');
var utils = require('../utils');

var projectDir = jetpack;
var srcDir = projectDir.cwd('./app');

// -------------------------------------
// Tasks
// -------------------------------------

var bundleApplication = function () {
  return Q.all([
    bundle(srcDir.path('background-process.js'), srcDir.path('background-process.build.js')),
    bundle(srcDir.path('webview-preload.js'), srcDir.path('webview-preload.build.js')),
    bundle(srcDir.path('shell-window.js'), srcDir.path('shell-window.build.js'), { browserify: true, basedir: srcDir.cwd(), excludeNodeModules: true }),
    bundle(srcDir.path('builtin-pages/start.js'), srcDir.path('builtin-pages/start.build.js'), { browserify: true, basedir: srcDir.cwd() })
  ]);
};

var bundleSpecs = function () {
  return generateSpecImportsFile().then(function (specEntryPointPath) {
    return bundle(specEntryPointPath, srcPath.path('spec.build.js'));
  });
};

var bundleTask = function () {
  if (utils.getEnvName() === 'test') {
    return bundleSpecs();
  }
  return bundleApplication();
};
gulp.task('bundle', bundleTask);
gulp.task('bundle-watch', bundleTask);


var buildLess = function (src, dest) {
  return gulp.src(src)
    .pipe(plumber())
    .pipe(less())
    .pipe(gulp.dest(dest));
}
var lessTask = function () {
  return  Q.all([
    buildLess('app/stylesheets/shell-window.less', srcDir.path('stylesheets')),
    buildLess('app/stylesheets/builtin-pages/start.less', srcDir.path('stylesheets/builtin-pages')),
    buildLess('app/stylesheets/builtin-pages/view-dat.less', srcDir.path('stylesheets/builtin-pages'))
  ])
};
gulp.task('less', lessTask);
gulp.task('less-watch', lessTask);

gulp.task('build', ['bundle', 'less']);

gulp.task('watch', ['build'], function () {
  watch('app/**/*.js', batch(function (events, done) {
    gulp.start('bundle-watch', done);
  }));
  watch('app/**/*.less', batch(function (events, done) {
    gulp.start('less-watch', done);
  }));
});
