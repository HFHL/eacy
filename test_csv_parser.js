import fs from 'fs';
import Papa from 'papaparse';
import { CSVConverter } from './frontend/src/components/FormDesigner/utils/csvConverter.js';
import { CSV_COLUMNS } from './frontend/src/components/FormDesigner/core/constants.js';

const csvPath = './字段配置模版-四院.csv';
const content = fs.readFileSync(csvPath, 'utf-8');
Papa.parse(content, {
  header: false,
  complete: function(results) {
    try {
      const designModel = CSVConverter.csvToDesignModel(results.data);
      console.log("Total Folders:", designModel.folders.length);
      
      let totalGroups = 0;
      let totalFields = 0;
      let totalNestedChildren = 0;

      designModel.folders.forEach(f => {
        totalGroups += f.groups.length;
        f.groups.forEach(g => {
          totalFields += g.fields.length;
          g.fields.forEach(field => {
             if (field.children) {
                 totalNestedChildren += field.children.length;
             }
          });
        });
      });
      console.log(`Groups: ${totalGroups}`);
      console.log(`Fields: ${totalFields}`);
      console.log(`Nested Children (Level 3): ${totalNestedChildren}`);
      
      // Let's print out what "生化指标" looks like to verify
      const shengHua = designModel.folders
         .find(f => f.name === '检验检查')
         ?.groups.find(g => g.name === '生化指标')
         ?.fields;
         
      console.log("\n生化指标 fields:");
      console.log(JSON.stringify(shengHua?.map(f => ({name: f.name, type: f.displayType, repeatable: f.repeatable, children: f.children?.length})), null, 2));

    } catch (e) {
      console.error(e);
    }
  }
});
