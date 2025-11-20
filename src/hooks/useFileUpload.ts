import { useState } from 'react';
import Papa from 'papaparse';
import { SearchDataBase } from '../utils/types';

export function useFileUpload() {
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [selectedIdColumn, setSelectedIdColumn] = useState<string>('');
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [searches, setSearches] = useState<SearchDataBase[]>([]);

  const processSearchData = (data: any[], idColumn: string): SearchDataBase[] => {
    return data
      .filter((row: any) => row[idColumn])
      .map((row: any) => ({
        name: row[idColumn],
        metadata: Object.keys(row)
          .filter((key) => key !== idColumn)
          .reduce((acc, key) => ({ ...acc, [key.trim()]: row[key] }), {}),
      }));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFileName(file.name);
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          const headers = results.meta.fields || [];
          setAvailableColumns(headers);
          setParsedData(results.data);

          // Auto-select reference column
          let defaultColumn = headers[0];
          if (headers.includes('search name')) {
            defaultColumn = 'search name';
          } else if (headers.includes('UW_Sample_ID')) {
            defaultColumn = 'UW_Sample_ID';
          }
          setSelectedIdColumn(defaultColumn);

          // Process data with selected ID column
          const processedSearches = processSearchData(results.data, defaultColumn);
          setSearches(processedSearches);
        },
      });
    }
  };

  const handleIdColumnChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newIdColumn = event.target.value;
    setSelectedIdColumn(newIdColumn);

    if (parsedData.length > 0) {
      const processedSearches = processSearchData(parsedData, newIdColumn);
      setSearches(processedSearches);
    }
  };

  return {
    searches,
    availableColumns,
    selectedIdColumn,
    selectedFileName,
    handleFileUpload,
    handleIdColumnChange,
  };
}