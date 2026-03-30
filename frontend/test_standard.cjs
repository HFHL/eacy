require('@babel/register')({ presets: ['@babel/preset-env', '@babel/preset-react'] });
const fs = require('fs');
const Papa = require('papaparse');
const path = require('path');
const { CSVConverter } = require('./src/components/FormDesigner/utils/csvConverter.js');

const csvPath = path.resolve('../标准CRF模版-含Table和Group示例.csv');
const content = fs.readFileSync(csvPath, 'utf-8');
Papa.parse(content, {
  header: false,
  complete: function(results) {
    const designModel = CSVConverter.csvToDesignModel(results.data);
    
    // Check forms
    for (const folder of designModel.folders) {
       for (const group of folder.groups) {
          console.log(`\n=== Form: ${group.name} ===`);
          for (const f of group.fields) {
             console.log(`Field: ${f.name} (Type: ${f.displayType})`);
             if (f.children && f.children.length > 0) {
                 for (const child of f.children) {
                     console.log(`  -> Child: ${child.name} (Type: ${child.displayType})`);
                 }
             }
          }
       }
    }
  }
});
