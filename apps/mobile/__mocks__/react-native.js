const React = require('react');

const element = (name) => (props) => React.createElement(name, props, props.children);

module.exports = {
  StatusBar: element('StatusBar'),
  Text: element('Text'),
  View: element('View'),
  StyleSheet: { create: (styles) => styles },
};
