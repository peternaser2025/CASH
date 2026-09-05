export interface CompanyPrintProfile {
  companyNameAr: string;
  companyNameEn: string;
  subTitleAr: string;
  subTitleEn: string;
  commercialRegistration: string;
  taxNumber: string;
  phone: string;
  email: string;
  address: string;
  currency: string;
  logoUrl?: string;
  stampText: string;
}

export interface PrintDisplayOptions {
  paperSize: 'A4-portrait' | 'A4-landscape' | 'A5-portrait' | 'thermal-80mm';
  showLetterhead: boolean;
  showSignatures: boolean;
  showStamp: boolean;
  showQRCode: boolean;
  watermark: 'none' | 'approved' | 'original' | 'draft' | 'confidential';
  fontSize: 'compact' | 'standard' | 'large';
  colorMode: 'color' | 'monochrome';
}

export const DEFAULT_COMPANY_PROFILE: CompanyPrintProfile = {
  companyNameAr: 'مصنع دار السلام',
  companyNameEn: 'Dar Al-Salam Factory',
  subTitleAr: 'الإدارة المالية والمحاسبية — قسم الخزينة والعهد المالية',
  subTitleEn: 'Financial & Accounting Administration — Treasury & Custody',
  commercialRegistration: 'س.ت: 489214',
  taxNumber: 'رقم المنشأة: 90218-KW',
  phone: '+965 2200 4589',
  email: 'daralsalam2factory@gmail.com',
  address: 'دولة الكويت — صبحان الصناعية / الشويخ',
  currency: 'د.ك (KWD)',
  stampText: 'مصنع دار السلام - الإدارة المالية - معتمد'
};

export const DEFAULT_PRINT_OPTIONS: PrintDisplayOptions = {
  paperSize: 'A4-portrait',
  showLetterhead: true,
  showSignatures: true,
  showStamp: true,
  showQRCode: true,
  watermark: 'none',
  fontSize: 'standard',
  colorMode: 'color'
};

const STORAGE_KEY_COMPANY = 'kwd_print_company_profile_v2';
const STORAGE_KEY_OPTIONS = 'kwd_print_display_options_v2';

export const getCompanyProfile = (): CompanyPrintProfile => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_COMPANY);
    if (saved) {
      return { ...DEFAULT_COMPANY_PROFILE, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('Error reading company print profile:', e);
  }
  return DEFAULT_COMPANY_PROFILE;
};

export const saveCompanyProfile = (profile: CompanyPrintProfile): void => {
  try {
    localStorage.setItem(STORAGE_KEY_COMPANY, JSON.stringify(profile));
  } catch (e) {
    console.warn('Error saving company print profile:', e);
  }
};

export const getPrintDisplayOptions = (): PrintDisplayOptions => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_OPTIONS);
    if (saved) {
      return { ...DEFAULT_PRINT_OPTIONS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('Error reading print display options:', e);
  }
  return DEFAULT_PRINT_OPTIONS;
};

export const savePrintDisplayOptions = (options: PrintDisplayOptions): void => {
  try {
    localStorage.setItem(STORAGE_KEY_OPTIONS, JSON.stringify(options));
  } catch (e) {
    console.warn('Error saving print display options:', e);
  }
};
