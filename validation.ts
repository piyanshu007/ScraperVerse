export interface SchemaFieldConfig {
  type: 'string' | 'number';
  required: boolean;
  min?: number;
  max?: number;
}

export type SchemaConfig = Record<string, SchemaFieldConfig>;

export interface ValidationResult {
  isValid: boolean;
  totalRecords: number;
  validRecordsCount: number;
  invalidRecordsCount: number;
  fieldStatus: Record<string, {
    validCount: number;
    missingCount: number;
    invalidTypeCount: number;
    outOfRangeCount: number;
  }>;
  failedFields: string[]; // List of fields that are considered failed (e.g. required field missing too many values)
  confidence: number; // 0 to 100
}

export function validateRecord(record: Record<string, any>, schema: SchemaConfig): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  let isValid = true;

  for (const [field, config] of Object.entries(schema)) {
    const val = record[field];

    // Check if missing
    if (val === undefined || val === null || val === '') {
      if (config.required) {
        errors[field] = 'Required field is missing';
        isValid = false;
      }
      continue;
    }

    // Check type
    if (config.type === 'number') {
      let numVal = Number(val);
      if (isNaN(numVal) && typeof val === 'string') {
        const cleaned = val.replace(/,/g, '');
        const match = cleaned.match(/[\d.]+/);
        if (match) {
          numVal = parseFloat(match[0]);
        }
      }

      if (isNaN(numVal)) {
        errors[field] = 'Must be a number';
        isValid = false;
        continue;
      }

      // Check min/max
      if (config.min !== undefined && numVal < config.min) {
        errors[field] = `Must be at least ${config.min}`;
        isValid = false;
      }
      if (config.max !== undefined && numVal > config.max) {
        errors[field] = `Must be at most ${config.max}`;
        isValid = false;
      }
    } else {
      if (typeof val !== 'string') {
        errors[field] = 'Must be a string';
        isValid = false;
      }
    }
  }

  return { isValid, errors };
}

export function validateDataset(records: Record<string, any>[], schema: SchemaConfig): ValidationResult {
  // Normalize numeric fields in the incoming records first so they are saved correctly in db and validate correctly!
  for (const record of records) {
    for (const [field, config] of Object.entries(schema)) {
      if (config.type === 'number' && record[field] !== undefined && record[field] !== null && record[field] !== '') {
        const val = record[field];
        if (typeof val !== 'number') {
          let numVal = Number(val);
          if (isNaN(numVal) && typeof val === 'string') {
            const cleaned = val.replace(/,/g, '');
            const match = cleaned.match(/[\d.]+/);
            if (match) {
              numVal = parseFloat(match[0]);
            }
          }
          if (!isNaN(numVal)) {
            record[field] = numVal;
          }
        }
      }
    }
  }

  const totalRecords = records.length;
  let validRecordsCount = 0;
  
  const fieldStatus: ValidationResult['fieldStatus'] = {};
  for (const field of Object.keys(schema)) {
    fieldStatus[field] = {
      validCount: 0,
      missingCount: 0,
      invalidTypeCount: 0,
      outOfRangeCount: 0,
    };
  }

  // If no records were scraped at all, it is a complete failure
  if (totalRecords === 0) {
    return {
      isValid: false,
      totalRecords: 0,
      validRecordsCount: 0,
      invalidRecordsCount: 0,
      fieldStatus,
      failedFields: Object.keys(schema),
      confidence: 0,
    };
  }

  for (const record of records) {
    let isRecordValid = true;
    for (const [field, config] of Object.entries(schema)) {
      const val = record[field];
      const status = fieldStatus[field];

      if (val === undefined || val === null || val === '') {
        status.missingCount++;
        if (config.required) {
          isRecordValid = false;
        }
        continue;
      }

      if (config.type === 'number') {
        const numVal = Number(val);
        if (isNaN(numVal)) {
          status.invalidTypeCount++;
          isRecordValid = false;
        } else if ((config.min !== undefined && numVal < config.min) || (config.max !== undefined && numVal > config.max)) {
          status.outOfRangeCount++;
          isRecordValid = false;
        } else {
          status.validCount++;
        }
      } else {
        if (typeof val === 'string') {
          status.validCount++;
        } else {
          status.invalidTypeCount++;
          isRecordValid = false;
        }
      }
    }

    if (isRecordValid) {
      validRecordsCount++;
    }
  }

  // Determine which fields failed overall
  // A field is failed if it is required and has any missing or invalid values, 
  // or if an optional field has 100% missing values (indicating selector break)
  const failedFields: string[] = [];
  for (const [field, config] of Object.entries(schema)) {
    const status = fieldStatus[field];
    const failureRate = (status.missingCount + status.invalidTypeCount + status.outOfRangeCount) / totalRecords;

    if (config.required && failureRate > 0) {
      failedFields.push(field);
    } else if (!config.required && (status.missingCount + status.invalidTypeCount + status.outOfRangeCount) === totalRecords) {
      // Optional field completely missing points to a broken selector
      failedFields.push(field);
    }
  }

  // Calculate dataset confidence score (0 to 100)
  // Weighted: 60% based on required fields success, 40% based on record level validation pass rate
  let requiredFieldsScore = 100;
  const requiredFields = Object.keys(schema).filter(f => schema[f].required);
  if (requiredFields.length > 0) {
    let totalRequiredFieldsValidPercent = 0;
    for (const field of requiredFields) {
      totalRequiredFieldsValidPercent += (fieldStatus[field].validCount / totalRecords) * 100;
    }
    requiredFieldsScore = totalRequiredFieldsValidPercent / requiredFields.length;
  }

  const recordPassRate = (validRecordsCount / totalRecords) * 100;
  const confidence = Math.round((requiredFieldsScore * 0.6) + (recordPassRate * 0.4));

  return {
    isValid: failedFields.length === 0,
    totalRecords,
    validRecordsCount,
    invalidRecordsCount: totalRecords - validRecordsCount,
    fieldStatus,
    failedFields,
    confidence,
  };
}
