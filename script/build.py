import os
import re

USERSCRIPT_FILE = 'ASF-STM.js'
RELEASE_FILE = 'ASF-STM.user.js'
DEBUG_FILE = 'ASF-STM.debug.js'

# Transform placeholder from camelCase to SCREAMING_SNAKE_CASE
def screaming_snake_to_camel(string):
    snake_case = re.sub(r'([a-z])([A-Z])', r'\1_\2', string)
    return snake_case.upper()

# Minifies template literals containing HTML by removing tabs and newlines
# Also removes /* HTML */ comment and enclosing backticks used for syntax highlighting
def minify_js_html_template(content):
    content = re.sub(r'(\r|\n|( {4})|`|\/\* HTML \*\/)', '', content)
    content = re.sub(r' {2,}', ' ', content)
    return content

# Modified version of CSS minifier by Borgar
# https://stackoverflow.com/a/223689/5853386 (Accessed on 2024-12-27)
def minify_css(css):
    rules = []

    # remove comments - this will break a lot of hacks :-P
    css = re.sub(r'\s*/\*\s*\*/', '$$HACK1$$', css) # preserve IE<6 comment hack
    css = re.sub(r'/\*[\s\S]*?\*/', '', css)
    css = css.replace('$$HACK1$$', '/**/') # preserve IE<6 comment hack

    # url() doesn't need quotes
    css = re.sub(r'url\((["\'])([^)]*)\1\)', r'url(\2)', css)

    # spaces may be safely collapsed as generated content will collapse them anyway
    css = re.sub(r'\s+', ' ', css )

    # shorten collapsable colors: #aabbcc to #abc
    css = re.sub(r'#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3(\s|;)', r'#\1\2\3\4', css)

    # fragment values can loose zeros
    css = re.sub(r':\s*0(\.\d+([cm]m|e[mx]|in|p[ctx]))\s*;', r':\1;', css)

    for rule in re.findall(r'([^{]+){([^}]*)}', css):

        # we don't need spaces around operators
        selectors = [re.sub(r'(?<=[\[\(>+=])\s+|\s+(?=[=~^$*|>+\]\)])', r'', selector.strip()) for selector in rule[0].split(',')]

        # order is important, but we still want to discard repetitions
        properties = {}
        porder = []
        for prop in re.findall('(.*?):(.*?)(;|$)', rule[1]):
            key = prop[0].strip().lower()
            if key not in porder: porder.append(key)
            properties[key] = prop[1].strip()

        # output rule if it contains any declarations
        if properties:
            rules.append('%s{%s}' % (','.join(selectors), ''.join(['%s:%s;' % (key, properties[key]) for key in porder])[:-1]))
    return ''.join(rules)

def main():
    with open(USERSCRIPT_FILE, 'r', encoding='utf8') as f:
        script = f.read()

    for file in os.listdir('./templates'):
        # Init placeholder: variableName -> {{VARIABLE_NAME}}
        placeholder = '{{%s}}' % screaming_snake_to_camel(os.path.splitext(file)[0])

        # Get and minify content where possible
        with open(f'./templates/{file}', 'r', encoding='utf8') as f:
            content = f.read()
        if file.endswith('.js'):
            content = minify_js_html_template(content)
        elif file.endswith('.css'):
            content = minify_css(content)
        elif file == 'version':
            content = content.strip()
        
        # Replace placeholder with content
        script = script.replace(placeholder, content)


    with open(DEBUG_FILE, 'w', encoding='utf8') as f:
        f.write(script.replace('  // DEBUG', ''))

    with open(RELEASE_FILE, 'w', encoding='utf8') as f:
        release_script = '\n'.join([x for x in script.split('\n') if not x.endswith('// DEBUG')])
        f.write(release_script)

main()
