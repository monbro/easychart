(function () {
    var dataService = require('../../services/data.js');
    var papa = require('papaparse');
    var _ = require('lodash');
    var h = require('virtual-dom/h');
    var createElement = require('virtual-dom/create-element');

    var that = {};
    that.load = function (element) {
        var input = createElement(h('textArea'));
        var importElement = createElement(
            h('button', {
                'ev-click': function(){
                    saveData(input.value)
                }
            }, 'import'));

        function saveData(value) {
            dataService.set(papa.parse(value).data);
        }
        element.appendChild(input);
        element.appendChild(importElement);
    };
    module.exports = that;
})();
