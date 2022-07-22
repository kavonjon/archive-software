from django import template
from django.utils.safestring import mark_safe

register = template.Library()

@register.filter('sizify')
def sizify(value):
    """
    Simple kb/mb/gb size snippet for templates:

    {{ product.file.size|sizify }}
    """
    #value = ing(value)
    if value < 1048576:
        value = value / 1024.0
        ext = 'KB'
    elif value < 1073741824:
        value = value / 1048576.0
        ext = 'MB'
    else:
        value = value / 1073741824.0
        ext = 'GB'
    return '%s %s' % (str(round(value, 2)), ext)

@register.filter('has_group')
def has_group(user, group_name):
    """
    Verifies that a user is in a group
    """
    groups = user.groups.all().values_list('name', flat=True)
    return True if group_name in groups else False

def collaborator_to_name_string(collaborator, style='name'):
    if style == 'all_names':
        name_list = [collaborator.name]
        if collaborator.nickname:
            name_list.append(collaborator.nickname)
        if collaborator.other_names:
            name_list.append(collaborator.other_names)
        return ', '.join(name_list)
    else:
        return collaborator.name

def anonymize_collaborator(collaborator, user, style):
    if collaborator.anonymous == True:
        if has_group(user, "Archivist"):
            return collaborator_to_name_string(collaborator, style) + " (anonymous)"
        else:
            return "(anonymous)"
    else:
        return collaborator_to_name_string(collaborator, style)

@register.simple_tag
def anonymize_collaborators(collaborators, user, style):
    """
    masks identity of list of collaborators or single collaborator
    """
    try:
        iter(collaborators)
        collaborators_names = []
        for collaborator in collaborators:
            collaborators_names.append(anonymize_collaborator(collaborator, user, style))
    except:
        collaborators_names = anonymize_collaborator(collaborators, user, style)
    return collaborators_names

@register.simple_tag(takes_context=True)
def url_replace(context, **kwargs):
    query = context['request'].GET.copy()

    for kwarg in kwargs:
        try:
            query.pop(kwarg)
        except KeyError:
            pass

    query.update(kwargs)

    return mark_safe(query.urlencode())
