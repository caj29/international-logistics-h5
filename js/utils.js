/**
 * 国际物流助手 H5 - 工具库 v1.0
 * 包含：8种定价模型价格计算、产品过滤、标签生成
 * 基于小程序 utils/common.js 重构，去除所有 wx.* API 依赖
 */

/* ========== 定价模型标准化 ========== */
function normalizePricingModel(model, product) {
  if (!model) {
    return _inferPricingModel((product && product.pricing) || null);
  }
  var m = String(model).toLowerCase().trim();
  var modelMap = {
    'per_kg':               'per_kg',
    'perkg':                'per_kg',
    'kg':                   'per_kg',
    'per_kg_with_base_fee': 'per_kg_with_base_fee',
    'perkgwithbasefee':     'per_kg_with_base_fee',
    'base_fee':             'per_kg_with_base_fee',
    'per_box':              'per_box',
    'perbox':               'per_box',
    'fixed_box':             'per_box',
    'fixedbox':             'per_box',
    'tiered':              'tiered',
    'tier':                 'tiered',
    'first_weight':         'tiered',
    'per_500g_with_base_fee': 'per_500g_with_base_fee',
    'per500gwithbasefee':  'per_500g_with_base_fee',
    'per_kg_tiers':        'per_kg_tiers',
    'perkgtiers':          'per_kg_tiers',
    'tiered_500g':         'tiered_500g',
    'tiered500g':          'tiered_500g',
    'per_kg_plus_handling': 'per_kg_plus_handling',
    'perkgplushandling':   'per_kg_plus_handling',
    'handling_fee':        'per_kg_plus_handling'
  };
  return modelMap[m] || m;
}

function _inferPricingModel(pricing) {
  if (!pricing || typeof pricing !== 'object') return 'unknown';
  // 1) per_box/fixed_box: 有 model=fixed_box 或 boxes[] 或 pricePerBox
  if (pricing && pricing.model === 'fixed_box') return 'per_box';
  if ('pricePerBox' in pricing || 'maxWeightPerBox' in pricing) return 'per_box';
  if (Array.isArray(pricing.boxes) && pricing.boxes.length > 0) return 'per_box';
  // 2) per_kg_plus_handling: 有 weightRanges 或 handlingFee
  if (Array.isArray(pricing.weightRanges) && pricing.weightRanges.length > 0) return 'per_kg_plus_handling';
  if ('handlingFee' in pricing || 'operationFee' in pricing) return 'per_kg_plus_handling';
  // 3) tiered_500g: 有 baseFee + continueRate
  if (pricing.baseFee !== undefined && pricing.continueRate !== undefined) return 'tiered_500g';
  // 4) per_kg_tiers: 有 tiers[] 且含 minWeight + (pricePerUnit 或 pricePerKg)
  if (Array.isArray(pricing.tiers) && pricing.tiers.length > 0) {
    var t = pricing.tiers[0];
    if (t.minWeight !== undefined && (t.pricePerUnit !== undefined || t.pricePerKg !== undefined)) return 'per_kg_tiers';
  }
  // 5) per_500g_with_base_fee: 有 baseFee + ratePer500g
  if (pricing.baseFee !== undefined && pricing.ratePer500g !== undefined) return 'per_500g_with_base_fee';
  // 6) tiered: 有 firstWeight + continueWeight
  if (pricing.firstWeight !== undefined && pricing.continueWeight !== undefined) return 'tiered';
  // 7) per_kg_with_base_fee: 有 baseFee + ratePerKg
  if (pricing.baseFee !== undefined && pricing.ratePerKg !== undefined) return 'per_kg_with_base_fee';
  // 8) per_kg: 只有 ratePerKg
  if (pricing.ratePerKg !== undefined) return 'per_kg';
  return 'unknown';
}

/* ========== 核心：价格计算（全部8种模型） ========== */
function calculatePrice(product, weightG) {
  if (!product) return null;
  var wg = Number(weightG) || 0;
  if (wg <= 0) return null;

  var wKg = wg / 1000;
  var pr = product.pricing || {};
  var model = normalizePricingModel(product.pricingModel || '', product);

  // 如果 product.pricingModel 为空，尝试从 pricing.model 推断
  if (model === 'unknown' && pr && pr.model) {
    model = normalizePricingModel(pr.model, product);
  }

  var price = null;

  switch (model) {
    case 'per_kg': {
      // 模型1：按公斤计费（大货类 FBA卡派/空派）
      var rate = pr.ratePerKg || product.perKg || 0;
      price = wKg * rate;
      break;
    }

    case 'per_kg_with_base_fee': {
      // 模型2：基础费+每公斤（e邮宝/国际小包/部分大货）
      var base = pr.baseFee !== undefined ? pr.baseFee : (product.baseFee || 0);
      var rate = pr.ratePerKg !== undefined ? pr.ratePerKg : (product.ratePerKg || 0);
      var min = pr.minCharge || 0;
      price = base + wKg * rate;
      if (min > 0 && price < min) price = min;
      break;
    }

    case 'per_box': {
      // 模型3：按箱计费（海运集运）
      // 兼容两种数据格式：
      //   A) pr.pricePerBox（文档标准格式）
      //   B) pr.boxes[0].price（实际数据格式：每个箱型是独立产品记录）
      if (Array.isArray(pr.boxes) && pr.boxes.length > 0) {
        // 格式B：取第一个箱型的价格（当前产品 = 一个箱型）
        price = pr.boxes[0].price || 0;
      } else {
        // 格式A：直接取 pricePerBox
        price = pr.pricePerBox || 0;
      }
      break;
    }

    case 'tiered': {
      // 模型4：首重+续重（EMS/邮政）
      // 优先用 tiers[] 阶梯格式
      if (Array.isArray(pr.tiers) && pr.tiers.length > 0) {
        // 找匹配的阶梯
        var tier = null;
        for (var i = 0; i < pr.tiers.length; i++) {
          var t = pr.tiers[i];
          var max = t.max || t.maxWeight || Infinity;
          if (wKg <= max) { tier = t; break; }
        }
        if (!tier) tier = pr.tiers[pr.tiers.length - 1];
        price = (tier.price || 0) * wKg;
      } else if (pr.firstWeight !== undefined) {
        // 传统首重+续重
        var fw = pr.firstWeight || 500;
        var fp = pr.firstPrice || 0;
        var cw = pr.continueWeight || 500;
        var cp = pr.continuePrice || 0;
        // 注意：e邮宝系列 firstWeight 单位是 kg（不是 g）
        var fwKg = fw > 100 ? fw : fw; // 如果 >100 认为是 g，否则是 kg
        var cwKg = cw > 100 ? cw : cw;
        if (wKg <= fwKg) {
          price = fp;
        } else {
          var extra = wKg - fwKg;
          var units = Math.ceil(extra / cwKg);
          price = fp + units * cp;
        }
      }
      break;
    }

    case 'per_500g_with_base_fee': {
      // 模型5：500g为首重（部分 e邮宝）
      var base = pr.baseFee || 0;
      var rate = pr.ratePer500g || 0;
      var units = Math.ceil(wg / 500);
      price = base + (units - 1) * rate;
      break;
    }

    case 'per_kg_tiers': {
      // 模型6：重量区间阶梯价（大货类部分）
      if (Array.isArray(pr.tiers)) {
        var tier = null;
        for (var i = 0; i < pr.tiers.length; i++) {
          var t = pr.tiers[i];
          var minW = t.min || t.minWeight || 0;
          var maxW = t.max || t.maxWeight || Infinity;
          if (wKg >= minW && wKg <= maxW) { tier = t; break; }
        }
        if (!tier) tier = pr.tiers[pr.tiers.length - 1];
        price = ((tier.pricePerUnit || tier.pricePerKg || 0)) * wKg;
      }
      break;
    }

    case 'tiered_500g': {
      // 模型7：500g阶梯（e包裹）
      var base = pr.baseFee || 42;
      var rate = pr.continueRate || 38;
      var units = Math.ceil(wg / 500);
      price = base + (units - 1) * rate;
      break;
    }

    case 'per_kg_plus_handling': {
      // 模型8：操作费+运费（两种数据格式）
      if (Array.isArray(pr.weightRanges) && pr.weightRanges.length > 0) {
        // 格式A：weightRanges[]（handlingFee 在每个区间里）
        var range = null;
        for (var i = 0; i < pr.weightRanges.length; i++) {
          var r = pr.weightRanges[i];
          var max = r.max || Infinity;
          if (wKg <= max) { range = r; break; }
        }
        if (!range) range = pr.weightRanges[pr.weightRanges.length - 1];
        var handling = range.handlingFee || 0;
        var rate = range.ratePerKg || 0;
        price = handling + wKg * rate;
      } else {
        // 格式B：flat handlingFee + ratePerKg
        var handling = pr.handlingFee || pr.operationFee || 0;
        var rate = pr.ratePerKg || 0;
        price = handling + wKg * rate;
      }
      break;
    }

    default:
      // 未知模型：尝试用 perKg 字段
      if (product.perKg) {
        price = wKg * product.perKg;
      } else {
        return null;
      }
  }

  return price !== null ? Math.round(price * 100) / 100 : null;
}

/* ========== 产品过滤 ========== */
function filterByWeight(products, weightG) {
  var wg = Number(weightG) || 0;
  return products.filter(function(p) {
    // 检查最大重量限制
    if (p.maxWeight && wg > p.maxWeight) return false;
    // 检查最小重量限制
    if (p.minWeight && wg < p.minWeight) return false;
    return true;
  });
}

function filterByCargoType(products, cargoType) {
  if (!cargoType || cargoType === '全部') return products;
  return products.filter(function(p) {
    var types = p.goodsTypes || [];
    return types.some(function(t) { return t === cargoType || t === '全部'; });
  });
}

function filterByCountry(products, countryCode) {
  if (!countryCode) return products;
  var cc = String(countryCode).toUpperCase();
  return products.filter(function(p) {
    return p.countryCode && p.countryCode.toUpperCase() === cc;
  });
}

/* ========== 产品数据标准化（对应小程序 _enrich） ========== */
function enrichProducts(products, weightG, cargoType) {
  var wg = Number(weightG) || 0;
  var results = [];

  for (var i = 0; i < products.length; i++) {
    var p = JSON.parse(JSON.stringify(products[i])); // 深拷贝

    // 计算价格
    var price = calculatePrice(p, wg);
    p.price = price;
    p.isPriceable = (price !== null && price > 0);

    // 重量限制文本
    if (p.maxWeight) {
      p.weightLimitStr = '≤' + (p.maxWeight >= 1000 ? (p.maxWeight / 1000) + 'kg' : p.maxWeight + 'g');
    }

    // 时效文本
    if (p.details && p.details.transit) {
      var tr = p.details.transit;
      if (tr.avgDays) p.transitTime = '约' + Math.round(tr.avgDays) + '天';
      else if (tr.p80) p.transitTime = '约' + Math.round(tr.p80) + '天';
    }

    results.push(p);
  }

  return results;
}

/* ========== 生成产品卡片标签 ========== */
function generateCardTags(product) {
  var tags = { row1: [], row2: [] };

  // Row1: 货物类型
  if (product.goodsTypes && product.goodsTypes.length > 0) {
    tags.row1.push({ text: product.goodsTypes[0], type: 'cargo' });
  }

  // Row1: 价格优势标签
  if (product.price !== undefined && product.price !== null) {
    // 这个需要在外部比较，这里只生成基础标签
  }

  // Row2: 时效
  if (product.transitTime) {
    tags.row2.push({ text: product.transitTime, type: 'time' });
  }

  // Row2: 重量限制
  if (product.weightLimitStr) {
    tags.row2.push({ text: product.weightLimitStr, type: 'limit' });
  }

  // Row2: 追踪能力
  if (product.details && product.details.tracking) {
    var t = product.details.tracking;
    if (t.indexOf('全程') >= 0) tags.row2.push({ text: '全程追踪', type: 'feature' });
    else if (t.indexOf('部分') >= 0) tags.row2.push({ text: '部分追踪', type: 'feature' });
  }

  return tags;
}

/* ========== 工具函数导出 ========== */
window.LogisticsUtils = {
  normalizePricingModel: normalizePricingModel,
  calculatePrice: calculatePrice,
  filterByWeight: filterByWeight,
  filterByCargoType: filterByCargoType,
  filterByCountry: filterByCountry,
  enrichProducts: enrichProducts,
  generateCardTags: generateCardTags
};
