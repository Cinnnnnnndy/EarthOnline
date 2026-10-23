"""检查 Swift 里的界面文字是否都在 Localizable.xcstrings 里、并且有 en / ja 译文。
键的规则：中文原文；整数插值（变量名 n 或 nXxx）写成 %lld，其余插值写成 %@。
用法：python3 ios/Support/check_strings.py"""
import re, os, sys, json
HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=os.path.join(HERE, '..', 'EarthOnline')
EXCLUDE_FILES={'GazetteerData.swift','SampleTrips.swift','Diary.swift'}
CJK=re.compile(r'[　-ヿ㐀-鿿＀-￯]')
INT_NAME=re.compile(r'^n([A-Z]\w*)?$')

def literals(src):
    """yield (literal_body_raw, line_no, start_index) for normal (non-raw, non-multiline) string literals, skipping comments"""
    i=0; n=len(src); line=1
    while i<n:
        c=src[i]
        if c=='\n': line+=1; i+=1; continue
        if src.startswith('//',i):
            j=src.find('\n',i); i = n if j<0 else j; continue
        if src.startswith('/*',i):
            j=src.find('*/',i); line+=src[i:j].count('\n'); i=j+2; continue
        if src.startswith('#"',i):   # raw string: skip
            j=src.find('"#',i+2); line+=src[i:j].count('\n'); i=j+2; continue
        if src.startswith('"""',i):
            j=src.find('"""',i+3); line+=src[i:j].count('\n'); i=j+3; continue
        if c=='"':
            j=i+1; buf=''
            while j<n:
                if src[j]=='\\' and j+1<n and src[j+1]=='(':
                    # interpolation: find matching paren
                    depth=0; k=j+1
                    while k<n:
                        if src[k]=='(': depth+=1
                        elif src[k]==')':
                            depth-=1
                            if depth==0: break
                        elif src[k]=='"':
                            # nested string inside interpolation
                            k2=k+1
                            while src[k2]!='"': k2+= 2 if src[k2]=='\\' else 1
                            k=k2
                        k+=1
                    buf+=src[j:k+1]; j=k+1; continue
                if src[j]=='\\': buf+=src[j:j+2]; j+=2; continue
                if src[j]=='"': break
                buf+=src[j]; j+=1
            yield buf, line, i
            i=j+1; continue
        i+=1

def to_key(raw):
    out=''; i=0
    while i<len(raw):
        if raw.startswith('\\(',i):
            depth=0; k=i+1
            while True:
                if raw[k]=='(': depth+=1
                elif raw[k]==')':
                    depth-=1
                    if depth==0: break
                k+=1
            expr=raw[i+2:k].strip()
            out+='%lld' if INT_NAME.match(expr) else '%@'
            i=k+1; continue
        if raw.startswith('\\"',i): out+='"'; i+=2; continue
        if raw.startswith('\\n',i): out+='\n'; i+=2; continue
        if raw.startswith('\\\\',i): out+='\\'; i+=2; continue
        out+=raw[i]; i+=1
    return out

keys={}
for dp,_,fs in os.walk(ROOT):
    for f in fs:
        if not f.endswith('.swift') or f in EXCLUDE_FILES: continue
        p=os.path.join(dp,f); src=open(p).read()
        for raw,line,pos in literals(src):
            if not CJK.search(raw): continue
            ctx=src[max(0,pos-60):pos]
            if 'verbatim:' in ctx[-12:]: continue
            k=to_key(raw)
            keys.setdefault(k,[]).append(f'{f}:{line}')
EXCLUDE = set("、 ， ・ 零 〇 一 二 两 三 四 五 六 七 八 九 十 ·、，, 小时 小旅 大阪 京都 奈良 神户 雷克雅未克 维克 特罗姆瑟 罗弗敦 罗瓦涅米 奥斯陆 卑尔根 赫尔辛基 斯德哥尔摩 巴厘岛 普吉岛 马尔代夫 三亚 檀香山 圣托里尼 那霸 海口 东京 札幌 名古屋 福冈".split())  # 数据，不是界面文字

if __name__ == '__main__':
    cat = json.load(open(os.path.join(ROOT, 'Resources', 'Localizable.xcstrings')))['strings']
    bad = 0
    for k, where in sorted(keys.items(), key=lambda x: x[1][0]):
        if k in EXCLUDE:
            continue
        loc = cat.get(k, {}).get('localizations', {})
        miss = [l for l in ('en', 'ja') if l not in loc]
        if k not in cat or miss:
            bad += 1
            print(f'{where[0]}: {k!r} missing {miss or "key"}')
    print(f'{len(keys)} keys scanned, {bad} problems')
    sys.exit(1 if bad else 0)
