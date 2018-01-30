let gulp = require('gulp');
let ts = require('gulp-typescript');

gulp.task('default', function() {
    return gulp.src("**.ts")
           .pipe(ts(require('./tsconfig.json').compilerOptions))
           .pipe(gulp.dest('./ts'));
});
