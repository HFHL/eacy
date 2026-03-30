require('@babel/register')({
  presets: ['@babel/preset-env', '@babel/preset-react']
});
const fs = require('fs');
const Papa = require('papaparse');
const path = require('path');
const { CSVConverter } = require('./src/components/FormDesigner/utils/csvConverter.js');

const csvPath = path.resolve('../字段配置模版-四院.csv');
const content = fs.readFileSync(csvPath, 'utf-8');
Papa.parse(content, {
  header: false,
  complete: function(results) {
    const designModel = CSVConverter.csvToDesignModel(results.data);
    const shengHua = designModel.folders.find(f => f.name === '检验检查')?.groups.find(g => g.name === '生化指标')?.fields;
    
    // Print all fields in this group to see the entire returned flattened structure or hierarchical structure
    console.log("FIELDS:", JSON.stringify(shengHua, null, 2));
  }
});
