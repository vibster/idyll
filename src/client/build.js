const React = require('react');
const ReactDOM = require('react-dom');

const InteractiveDocument = require('./component');
const mountNode = document.getElementById('idyll-mount');

const ast = require('__IDYLL_AST__');
const componentClasses = require('__IDYLL_COMPONENTS__');
const datasets = require('__IDYLL_DATA__');

ReactDOM.render(
  <InteractiveDocument
    ast={ast}
    componentClasses={componentClasses}
    datasets={datasets}
  />,
  mountNode
);
