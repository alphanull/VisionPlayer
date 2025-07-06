module.exports = {
    plugins: [
        require('postcss-combine-media-query'),
        require('postcss-combine-duplicated-selectors')({ removeDuplicatedProperties: true, removeDuplicatedValues: false }),
        require('postcss-inline-svg')({ paths: ['assets/svg/'] }),
        require('postcss-input-range'),
        require('autoprefixer'),
        require('cssnano'),
        require('postcss-reporter')
    ]
};
