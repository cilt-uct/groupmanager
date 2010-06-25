/*
 * jQuery plugin: autoCompletefb(AutoComplete Facebook)
 * @requires jQuery v1.2.2 or later
 * using plugin:jquery.autocomplete.js
 *
 * Credits:
 * - Idea: Facebook
 * - Guillermo Rauch: Original MooTools script
 * - InteRiders <http://interiders.com/> 
 *
 * Copyright (c) 2008 Widi Harsojo <wharsojo@gmail.com>, http://wharsojo.wordpress.com/
 * Dual licensed under the MIT and GPL licenses:
 *   http://www.opensource.org/licenses/mit-license.php
 *   http://www.gnu.org/licenses/gpl.html
 */
 
jQuery.fn.autoCompletefb = function(options) 
{
	var tmp = this;
	var settings = 
	{
		ul         : tmp,
		urlLookup  : [""],
		acOptions  : {},
		foundClass : ".acfb-data",
		inputClass : ".acfb-input",
        deleteImage: "",
        selectedUserIds: []
	}
	if(options) jQuery.extend(settings, options);
	
	var acfb = 
	{
		params  : settings,
		getData : function()
		{	
			var result = '';
		    $(settings.foundClass,tmp).each(function(i)
			{
				if (i>0)result+=',';
			    result += $('span',this).html();
		    });
			return result;
		},
		clearData : function()
		{	
		    $(settings.foundClass,tmp).remove();
			$(settings.inputClass,tmp).focus();
			return false;
		},
		removeFind : function(o){
			$(o).unbind('click').parent().remove();
			$(settings.inputClass,tmp).focus();
			sakai.groups.manager.resizeFrame();
			return false;
		}
	}
	
	$(settings.foundClass+" img.p").click(function(){
		acfb.removeFind(this);
		sakai.groups.manager.resizeFrame();
        return false;
	});
	
	$(settings.inputClass,tmp).autocomplete(settings.urlLookup,settings.acOptions);
	$(settings.inputClass,tmp).result(function(e,member,f){
        e.preventDefault();
        //see is user is selected already
        if( !sakai.groups.manager.isMemberSelected(member.userId)) {
            settings.selectedUserIds.push(member.userId);
            var f = settings.foundClass.replace(/\./,'');
            var v = '<li class="'+f+'" title="'+member.userSortName + ' (' + member.userDisplayId + ')"><span name="'+member.userId+'" class="autocomplete-member" >'+member.userSortName+'</span> <img class="p" src="'+settings.deleteImage+'"/></li>';
            var x = $(settings.inputClass,tmp).before(v);
            $('.p',x[0].previousSibling).click(function(e){
                e.preventDefault();
                acfb.removeFind(this);
                return false;
            });
            sakai.groups.manager.resizeFrame();
        }
        $(settings.inputClass,tmp).val('').focus();
        return false;
	});
	$(settings.inputClass,tmp).focus();
	return acfb;
}
