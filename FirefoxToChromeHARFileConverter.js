const fs = require('fs');
const path = require('path');

/**
 * تبدیل مقادیر رشته‌ای به اعداد اعشاری
 * @param {Object|Array} obj - آبجکت یا آرایه ورودی
 * @returns {Object|Array} - آبجکت یا آرایه اصلاح شده
 */
function convertStringNumbersToFloat(obj) {
  const numberFields = [
    'time', 'timings', 'bodySize', 'headersSize', 'connect',
    'wait', 'receive', 'send', 'ssl', 'blocked', 'dns', 'compression', 'size'
  ];

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => convertStringNumbersToFloat(item));
  }

  if (typeof obj === 'object') {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (numberFields.includes(key) && typeof obj[key] === 'string') {
          // تبدیل رشته به عدد
          if (obj[key].trim() === '') {
            obj[key] = 0;
          } else {
            const parsed = parseFloat(obj[key]);
            obj[key] = isNaN(parsed) ? 0 : parsed;
          }
        } else if (typeof obj[key] === 'object' || Array.isArray(obj[key])) {
          obj[key] = convertStringNumbersToFloat(obj[key]);
        }
      }
    }
  }

  return obj;
}

/**
 * اطمینان از وجود تمام فیلدهای ضروری
 * @param {Object} harData - داده‌های فایل HAR
 * @returns {Object} - داده‌های اصلاح شده
 */
function ensureRequiredFields(harData) {
  // اطمینان از وجود ساختار اصلی
  if (!harData.log) {
    harData.log = {};
  }

  if (!harData.log.creator) {
    harData.log.creator = {
      name: 'Firefox',
      version: 'unknown',
      comment: 'Converted by Firefox HAR Converter'
    };
  }

  if (!harData.log.entries) {
    harData.log.entries = [];
  }

  // اصلاح هر entry
  harData.log.entries.forEach(entry => {
    // اطمینان از وجود فیلدهای ضروری
    if (!entry.request) {
      entry.request = {};
    }

    if (!entry.response) {
      entry.response = {};
    }

    if (!entry.timings) {
      entry.timings = {
        blocked: 0,
        dns: 0,
        connect: 0,
        ssl: 0,
        send: 0,
        wait: 0,
        receive: 0
      };
    } else {
      // اطمینان از وجود تمام فیلدهای زمان‌بندی
      const timingFields = ['blocked', 'dns', 'connect', 'ssl', 'send', 'wait', 'receive'];
      timingFields.forEach(timing => {
        if (entry.timings[timing] === undefined) {
          entry.timings[timing] = 0;
        }
      });

      // اصلاح مقادیر منفی یا نامعتبر
      for (const key in entry.timings) {
        if (entry.timings[key] === null || 
            (typeof entry.timings[key] === 'number' && entry.timings[key] < 0)) {
          entry.timings[key] = 0;
        }
      }
    }
  });

  return harData;
}

/**
 * اصلاح قالب زمان
 * @param {Object} harData - داده‌های فایل HAR
 * @returns {Object} - داده‌های اصلاح شده
 */
function fixTimestamps(harData) {
  harData.log.entries.forEach(entry => {
    if (entry.startedDateTime && typeof entry.startedDateTime === 'number') {
      // تبدیل عدد به رشته زمانی ISO
      try {
        // اگر به میلی‌ثانیه باشد
        let date = new Date(entry.startedDateTime);
        if (!isValidDate(date)) {
          // اگر به ثانیه باشد
          date = new Date(entry.startedDateTime * 1000);
        }
        
        if (isValidDate(date)) {
          entry.startedDateTime = date.toISOString();
        } else {
          // در صورت خطا، زمان فعلی را قرار می‌دهیم
          entry.startedDateTime = new Date().toISOString();
        }
      } catch (e) {
        // در صورت خطا، زمان فعلی را قرار می‌دهیم
        entry.startedDateTime = new Date().toISOString();
      }
    }
  });

  return harData;
}

/**
 * بررسی معتبر بودن تاریخ
 * @param {Date} date - آبجکت تاریخ
 * @returns {boolean} - آیا تاریخ معتبر است
 */
function isValidDate(date) {
  return date instanceof Date && !isNaN(date);
}

/**
 * اصلاح انواع MIME
 * @param {Object} harData - داده‌های فایل HAR
 * @returns {Object} - داده‌های اصلاح شده
 */
function fixMimeTypes(harData) {
  harData.log.entries.forEach(entry => {
    if (entry.response && entry.response.content) {
      if (!entry.response.content.mimeType || entry.response.content.mimeType === '') {
        entry.response.content.mimeType = 'application/octet-stream';
      }
    }
  });

  return harData;
}

/**
 * فایل HAR فایرفاکس را اصلاح می‌کند تا با کروم سازگار شود
 * @param {string} inputFile - مسیر فایل HAR ورودی
 * @param {string} outputFile - مسیر فایل HAR خروجی (اختیاری)
 * @returns {Promise<boolean|string>} - نتیجه عملیات
 */
async function fixHarFile(inputFile, outputFile) {
  try {
    // خواندن فایل HAR
    const harContent = await fs.promises.readFile(inputFile, 'utf-8');
    let harData = JSON.parse(harContent);
    
    // اصلاح ساختار فایل
    harData = convertStringNumbersToFloat(harData);
    harData = ensureRequiredFields(harData);
    harData = fixTimestamps(harData);
    harData = fixMimeTypes(harData);
    
    // تنظیم نام فایل خروجی اگر مشخص نشده باشد
    if (!outputFile) {
      const baseName = path.basename(inputFile, path.extname(inputFile));
      outputFile = path.join(path.dirname(inputFile), `${baseName}_chrome_compatible.har`);
    }
    
    // ذخیره فایل اصلاح شده
    await fs.promises.writeFile(outputFile, JSON.stringify(harData, null, 2), 'utf-8');
    
    console.log(`فایل با موفقیت اصلاح شد و در ${outputFile} ذخیره شد.`);
    return true;
  } catch (error) {
    console.error(`خطا در اصلاح فایل HAR: ${error.message}`);
    return error.message;
  }
}

/**
 * تابع اصلی برنامه
 */
async function main() {
  // گرفتن آرگومان‌های خط فرمان
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('خطا: مسیر فایل HAR را وارد کنید.');
    console.log('استفاده: node fix_har.js [مسیر_فایل_ورودی] [--output مسیر_فایل_خروجی]');
    process.exit(1);
  }
  
  const inputFile = args[0];
  let outputFile = null;
  
  // بررسی آرگومان output
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--output' || args[i] === '-o') {
      if (i + 1 < args.length) {
        outputFile = args[i + 1];
        break;
      }
    }
  }
  
  // بررسی وجود فایل ورودی
  try {
    await fs.promises.access(inputFile, fs.constants.F_OK);
  } catch (error) {
    console.error(`خطا: فایل ${inputFile} یافت نشد.`);
    process.exit(1);
  }
  
  const result = await fixHarFile(inputFile, outputFile);
  process.exit(result === true ? 0 : 1);
}

// اجرای برنامه
main().catch(error => {
  console.error(`خطای غیرمنتظره: ${error.message}`);
  process.exit(1);
});