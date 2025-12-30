import re

with open('app/page.js', 'r') as f:
    content = f.read()

# Find the Classic Cohorts tab section
pattern = r'(\s*{/\* Tab 6: Classic Cohort View \*/}.*?</Tab>)'
match = re.search(pattern, content, re.DOTALL)

if match:
    classic_section = match.group(1)
    lines = classic_section.split('\n')
    fixed_lines = []
    
    for line in lines:
        stripped = line.lstrip()
        
        # Tab definition line
        if '<Tab label=' in stripped:
            fixed_lines.append('          ' + stripped)
        # Opening div
        elif stripped.startswith('<div className="space-y-6">'):
            fixed_lines.append('            ' + stripped)
        # Comments
        elif stripped.startswith('{/*'):
            fixed_lines.append('              ' + stripped)
        # Main sections
        elif stripped.startswith('<Section') or stripped.startswith('<div className="grid'):
            fixed_lines.append('              ' + stripped)
        # MetricCard
        elif stripped.startswith('<MetricCard'):
            fixed_lines.append('                ' + stripped)
        # Closing tags at Tab level
        elif stripped == '</Tab>':
            fixed_lines.append('          ' + stripped)
        # Closing div for space-y-6
        elif stripped == '</div>' and len(fixed_lines) > 0 and 'space-y-6' in fixed_lines[1]:
            fixed_lines.append('            ' + stripped)
        else:
            # Keep relative indentation for nested content
            fixed_lines.append(line)
    
    fixed_section = '\n'.join(fixed_lines)
    new_content = content[:match.start()] + fixed_section + content[match.end():]
    
    with open('app/page.js', 'w') as f:
        f.write(new_content)
    
    print("Fixed Classic Cohorts tab indentation")
else:
    print("Could not find Classic Cohorts tab")
