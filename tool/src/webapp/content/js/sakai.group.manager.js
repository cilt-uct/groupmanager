/*
 *
 *Licensed to the Sakai Foundation (SF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The SF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 *
 * DEFINITION:
 *
 * 
 * 
 * @class sakai.groups.manager  
 * @author Lovemre Nalube lovemore.nalube@uct.ac.za
 *
 * @requires jQuery
 * @requires fluid
 */

/*global jQuery, sakai, fluid */

var sakai = sakai || {};
sakai.groups = sakai.groups || {};

/**
 * Define the groups manager
 */

sakai.groups.manager = function($, fluid){

    var //configurable vars
            debug = false,
            afterRemovalTime = 60000,  //how long is a user name shown after removal to allow undo action? in milisec.
            //images
            images = {
                src: {
                    autocompleteRemoveImage: "/sakai-groupmanager-tool/content/images/delete.gif",
                    undo: "/sakai-groupmanager-tool/content/images/arrow_undo.png",
                    loadingImage: "/library/image/sakai/spinner.gif",
                    loadingImageTiny: "/sakai-groupmanager-tool/content/images/loader_tiny.gif"
                },
                loadingImage: '<img class="img-loading" src="/library/image/sakai/spinner.gif" alt="Updating..." title="Updating..."/>'
            },

            ui = {
                groupNumber: {
                    titleSingular: "Group member",
                    titlePlural: "Group members"
                }
            },

            //non-configurable vars
            siteId = "",
            siteMembers = [],
            siteGroups = [],
            siteGroupMembers = [],
            siteHasGroups = true,
            currentGroup = {
                groupId: "",
                groupTitle: "",
                groupDescription: "",
                selectedMembers: [],
                members: []
            },
            siteRoles = [],
            initedAutocomplete = false,
            saveActions = {
                add: "add",
                update: "update",
                remove: "remove",
                ui: {
                    addPlural: "users </b>  were added to the group.",
                    addSingular: "user </b> was added to the group.",
                    updatePlural: "users </b> are now in the group.",
                    updateSingular: "user </b> is now in the group.",
                    removePlural: "users </b> were removed from the group.",
                    removeSingular: "user </b> was removed from the group.",
                    removeNuetral: "User(s) are not members of this group."
                }
            },
            _ajaxUndo = function(){},   //every ajax call has to specify an undo function in case of failure
            _ajaxUndoBefore = function(){},   //ajax call can specify action to run before the UI fauilure alert
            ajaxCustomErrorMsg = null,
            blankREG = /^\s*$/,   //Reg Exp. to test for an empty string
            rowTemplateForListRow = {},
            inlineEditors = [];

            //get site membership and group info into object
            _getSiteUsersAndGroups = function(){
                //clone table row from DOM for use later on
                var row = $("#groups-selector").find("tr[name=g-r]:eq(0)");
                //backup for template for use elseware
                rowTemplateForListRow = row.clone();
                //remove current dom row
                row.remove();

                var ebRefs = [ "/direct/membership/site/"+ siteId,  //will be response object ref0
                    "/direct/site/"+ siteId +"?includeGroups=true" ];            //will be response object ref1
                $.ajax({
                    url: "/direct/batch?_refs=" + ebRefs.toString(),
                    dataType: 'json',
                    cache: false,
                    global: false,
                    success: function(d){
                            var status;
                            if ( typeof d.ref0 !== "undefined" ){
                                status = d.ref0.status;
                                if( status === 200 || status === 201 || status === 204 ){
                                     for(var i in d.ref0.data.membership_collection){
                                          var memberFull = d.ref0.data.membership_collection[i],
                                          member = {
                                              "userId": memberFull.userId,     //Uuid
                                              "userDisplayId": memberFull.userDisplayId, //eg Staffnumber
                                              "userSortName": memberFull.userSortName
                                          };
                                          siteMembers.push( member );
                                         //console.info("FOUND USRE: %o", member);
                                      }
                                }else{
                                    //Error occured fetching site membership
                                    _errorStop("Ooops, an error occured fetching the Site Users. Are you logged in and have rights to edit groups?");
                                }
                            }
                            if( typeof d.ref1 !== "undefined" ){
                                status = d.ref1.status;
                                if( status === 200 || status === 201 || status === 204){
                                     for (var i = 0, il = d.ref1.data.siteGroups.length; i < il; i++) { 
                                          //console.info(personFull);
                                         var groupFull = d.ref1.data.siteGroups[i];
                                         // only use Site Info type groups
                                         if(groupFull.props !== null && groupFull.props.group_prop_wsetup_created === "true"){
                                              var group = {
                                                  "id": groupFull.id,
                                                  "title": groupFull.title,
                                                  "description": groupFull.description,
                                                  "members": []
                                              };

                                             if ( groupFull.users !== null || groupFull.users.length > 0){
                                                for (var n = 0, nl = groupFull.users.length; n < nl; n++) { 
                                                  var memberUserId = groupFull.users[n],
                                                  member = {
                                                      "userId": memberUserId,     //Uuid
                                                      "userDisplayId": null, //memberFull.userDisplayId, eg Staffnumber will populate later
                                                      "userSortName": null //memberFull.userSortName  will populate later
                                                  };
                                                  group.members.push( member );
                                                }
                                             }
                                             siteGroups.push( group );
                                             siteGroupMembers.push( { "groupId": groupFull.id, "members": group.members } );
                                         }
                                      }
                                    if( siteGroups.length === 0){
                                        siteHasGroups = false;
                                        $("#errors").text("This site has no groups").removeClass().addClass("information").show();
                                        $("img.img-loading").remove();
                                    }else{
                                        _event_showBindTableGroups();
                                    }

                                }else if (status === 500){
                                    siteHasGroups = false;
                                    $("#errors").text("This site has no groups").removeClass().addClass("information").show();
                                    $("img.img-loading").remove();
                                }else{
                                    //Error occured fetching groups
                                    _errorStop("Error occured fetching groups");
                                }
                            }
                        },
                        error: function(xhr) {
                            if (xhr.status === 500){
                                siteHasGroups = false;
                                $("#errors").text("This site has no groups").removeClass().addClass("information").show();
                                $("img.img-loading").remove();
                            }else{
                                ajaxCustomErrorMsg = "Oops, the server could not process your action due to this error: " + xhr.statusText + " (" + xhr.status + ").";
                                _errorStop(ajaxCustomErrorMsg, true);
                                alert(ajaxCustomErrorMsg);
                            }
                            return false;
                        }
                });

            },

            _event_showBindTableGroups = function(){
                // now we have the groups sort
                siteGroups.sort(_sortGroupsComparator('title', false, function(a){return a.toUpperCase();}));
                var table =  $("#groups-selector");

                //clear any crurrent rows
                table.find("tr[name=g-r]").remove();
                for (var i = 0, il = siteGroups.length; i < il; i++) { 
                    var group = siteGroups[i],
                    groupSize = 0,
                    rowTemp = rowTemplateForListRow.clone();
                    rowTemp.attr("id", "groupRow:" + group.id);
                    rowTemp.find("td[name=g-n] a")
                            .text(group.title)
                            .attr("href", "#" + group.title);
                    rowTemp.find("input[name=g-id]").val(group.id);
                    rowTemp.find("td[name=g-d]")
                            //.attr("title", group.description)
                            .text(_fixGroupDescriptionLength(group.description));

                    rowTemp.find("td[name=g-s]").text( ( typeof group.members !== "undefined" && group.members.length > 0) ? group.members.length : 0);
                    //add to dom
                    table.find("tbody").append(rowTemp);
                }

                 $("#groups-selector-title img").remove();
                 table.show();

                 _bindSaveActionEvents();

                 //handler for group selection event
                $("td[name=g-n] a").unbind("click").bind("click", _bindEditGroupLink);

                //handler for the remove group action
                $("a.group-remove").unbind("click").bind("click", function(){
                    var that = $(this),
                        thatRow = that.parents("tr[name=g-r]"),
                        groupId = thatRow.find("input[name=g-id]").val(),
                        groupTitle = thatRow.find("td[name=g-n] a").text(),
                        editLink = thatRow.find("td[name=g-n] a");
                    thatRow.addClass("selectedSelected");
                    _ajaxUndo = function(){
                        that.show();
                        thatRow.find("img.img-loading").remove();
                        editLink
                                .css("color", "")
                                .unbind("click").bind("click", _bindEditGroupLink);
                        thatRow.removeClass("selectedSelected");
                        return false;
                    };
                    $.ajax({
                        url: "/direct/site/" + siteId + "/group/" + groupId,
                        type: "DELETE",
                        beforeSend: function(){
                            if (!confirm("Are your sure you want to remove the group: " + groupTitle + "?")){
                                thatRow.removeClass("selectedSelected");
                                return false;
                            }
                            that.parent().append(images.loadingImage);
                            that.hide();
                            //disable edit link click action
                            editLink
                                    .css("color", "#666")
                                    .unbind("click").bind("click", function(){return false;});
                        },
                        success: function(){
                            thatRow.fadeOut("fast", function(){
                                thatRow.remove();
                                _event_resizeFrame();
                                if ( $("#groups-selector tr[name=g-r]").length === 0 ){
                                    //no more groups left
                                    siteHasGroups = false;
                                    $("#errors").text("This site has no groups").removeClass().addClass("information").show();
                                    $("#groups-selector").hide();
                                }
                            });
                        }
                    });
                    return false;
                });
            },
            // EB savers
            _saveGroup = function(action){

                var updateDomFns = _populateSelectedMembers(),
                backedUpUserIds = [];

                _ajaxUndo = function(){
                    $("#doAction").attr("disabled", "");
                    $("img.img-loading").remove();
                };
                $.ajax({
                    url: "/direct/membership/group/" + currentGroup.groupId,
                    type: "POST",
                    dataType: "JSON",
                    data: { action: action, userIds: currentGroup.selectedMembers.toString() },
                    beforeSend: function(){
                        if(currentGroup.selectedMembers.length === 0){
                            alert("Select at least one person with a valid username.");
                            $("#group-members-paste").removeClass("alertMessage");
                            return false;
                        }
                        $("#doAction").attr("disabled", "disabled");
                        $("div.doAction").append(images.loadingImage);
                    },
                    success: function(){
                        // show changed msg eg: (1 user added).

                        //re-select add option
                        $("input[id=action.a]").attr("checked","checked");
                        //update group object
                        $("#members-number").append(images.loadingImage);
                        $("input[name=g-id][value="+currentGroup.groupId+"]:hidden").parent().find("td[name=g-s]").append(images.loadingImage);
                        _updateMembersForGroup(currentGroup.groupId, function(){
                            $("#action-group-success").show();

                            backedUpUserIds = [];
                            for( var u in currentGroup.members){
                                backedUpUserIds.push(currentGroup.members[u].userId);
                            }

                            _doMembershipDOM(currentGroup.groupId);
                            var membershipDifference = (currentGroup.members.length > backedUpUserIds.length) ? currentGroup.members.length - backedUpUserIds.length : backedUpUserIds.length - currentGroup.members.length;

                            if( action === saveActions.update){
                                $("#action-group-success span").html('The group membership was changed. <b>' + currentGroup.members.length + " " +
                                    saveActions.ui[ currentGroup.members.length > 1 ? "updatePlural" : "updateSingular" ]);
                            }else{
                                if(membershipDifference !== 0 ){
                                    $("#action-group-success span").html('The group membership was changed. <b>' + membershipDifference + " " +
                                        saveActions.ui[ membershipDifference > 1 ? action +"Plural" : action + "Singular" ]);
                                }else{
                                    $("#action-group-success span").html('Group membership was not changed.' + ( action === saveActions.remove ? saveActions.ui.removeNuetral : 'User(s) are already members of the group.') );
                                }
                            }

                            $("#action-group-success").show();


                            //update DOM : 1. clear fields + re-init autocompleter 2. update members list
                            for(var f in updateDomFns ){
                                updateDomFns[f]();
                            }
                            currentGroup.selectedMembers = [];
                            $("#doAction").attr("disabled", "");
                            $("div.doAction img.img-loading").remove();

                            if(backedUpUserIds.length > 0 && membershipDifference !== 0){
                                $("a.img-undo").show();
                                //attach undo event
                                $("a.img-undo")
                                        .unbind("click").bind("click", function(){
                                            _event_undoAction(backedUpUserIds);
                                        });
                            }else{
                                $("a.img-undo").hide();
                            }

                        });
                        _event_resizeFrame();
                    }
                });

            },

            // Save action events
            _bindSaveActionEvents = function(){
                var selectedAction= "";
                $("#doAction").unbind("click").bind("click", function(){
                    //Get selected action
                    selectedAction = $("input[type=radio][name=action]:checked").val();
                   _saveGroup(selectedAction);
                });
            },

            _populateSelectedMembers = function(){
                // start collecting current userIds
                var tempUserNames = [],
                        notFound = [],
                        pasteBox,
                        successFns = [],
                        membersToRemove = [];
                //collect from the paste box
                pasteBox = $("#group-members-paste");
                if( pasteBox.length > 0 ){
                    tempUserNames = pasteBox.val().split('\n');
                    ///console.info("array length %i: %o", tempUserNames.length, tempUserNames);//.split(' ').join(''));
                    for (var a = 0, al = tempUserNames.length; a < al; a++) {
                        ///console.info("checking split: %s", tempUserNames[a].split(' ').join(''));
                        ///console.info("checking: %s", tempUserNames[a]);//.split(' ').join(''));
                        var found = false,
                        tempUsername = tempUserNames[a].replace(/ /g, "");
                        for( var b in siteMembers ){
                            ////console.info("checking: %s against: %s", tempUserNames[a], siteMembers[b].userDisplayId);//.split(' ').join(''));
                            if( !found && tempUsername !== null && tempUsername.toLowerCase() == siteMembers[b].userDisplayId.toLowerCase() ){
                                //member is valid
                                found = true;
                                currentGroup.selectedMembers.push(siteMembers[b].userId);
                                ///console.info("I will add this user: " + tempUserNames[a].split(' ').join(''));
                            }
                        }
                        if (!found){
                            //save member to later remove from paste box array
                            notFound.push(tempUsername);
                        }
                    }
                    ///console.info("currentGroup.selectedMembers length %i: %o", currentGroup.selectedMembers.length, currentGroup.selectedMembers);
                    ///console.info("userIdIndexesToSplice length %i: %o", notFound.length, notFound);

                    successFns.push(function(){
                        //show invalid users in the paste box
                        pasteBox.val(notFound.toString().split(',').join('\n'));
                        if( ! blankREG.test( pasteBox.val() )){
                            pasteBox.addClass("alertMessage");
                            alert("Invalid users found in paste box");
                        }else{
                            pasteBox.removeClass("alertMessage");
                        }
                    });
                }else{
                    //console.warn("Cannot find the paste box");
                }

                //collect from the autocomplete
                if( $("span.autocomplete-member").length > 0 ){
                    $("span.autocomplete-member").each(function(i, rawMember){
                        membersToRemove.push($(rawMember));
                        currentGroup.selectedMembers.push( $(rawMember).attr("name") );
                        /// .log("%s --- %o", $(rawMember).attr("name"), currentGroup.selectedMembers);
                    });

                    successFns.push(function(){
                        $("#group-current-members-autocomplete li").remove();
                        $("input.acfb-input").val("");
                    });
                }
                return successFns;
            },

            //fetch single group membership
            //function will update the groups' groupSiteMembers object if it exits. else it will add the object

            _updateMembersForGroup = function(groupId, successFn){

                _ajaxUndoBefore= function(){
                    ajaxCustomErrorMsg = "Your last action was done successfuly but due to an error this page cannot be updated to show the new member list.\n\nPlease refresh this page.";
                };
                _ajaxUndo = function(){
                    $("#doAction").attr("disabled", "");
                    $("img.img-loading").remove();
                };

                 $.getJSON( "/direct/membership/group/" + groupId + ".json?_id=" + new Date().getTime(), function(d){
                    var group = {
                        "groupId": groupId,
                        "members": []
                    },
                    foundAndUpdated = false;
                    for (var i = 0, il = d.membership_collection.length; i < il; i++) { 
                      var memberFull = d.membership_collection[i],
                      member = {
                          "userId": memberFull.userId,     //Uuid
                          "userDisplayId": memberFull.userDisplayId, //eg Staffnumber
                          "userSortName": memberFull.userSortName
                      };
                      group.members.push( member );
                    }

                    for (var i = 0, il = siteGroupMembers.length; i < il; i++) { 
                        if(groupId === siteGroupMembers[i].groupId ){
                            siteGroupMembers[i].members = group.members;
                            foundAndUpdated = true;
                        }
                    }

                    if (!foundAndUpdated){
                        siteGroupMembers.push( group );
                    }

                    if( successFn !== null ){
                        successFn();
                    }

                });
            },

            _doMembershipDOM = function(groupId){
                var members = [],
                memberDOM = "",
                displayLimit = 35,
                tableNumber = $("tr[id=groupRow:"+currentGroup.groupId+"]").find("td[name=g-s]");
                for (var i = 0, il = siteGroupMembers.length; i < il; i++) { 
                    if(groupId === siteGroupMembers[i].groupId ){
                        members = siteGroupMembers[i].members;
                    }
                }
                currentGroup.members = members;
                for (var n = 0, nl = members.length; n < nl; n++) {
                    var m = members[n],
                        memberHTML= "",
                        displayString = m.userSortName + ' (' + m.userDisplayId + ')';
                    displayString = displayString.length > displayLimit ? displayString.substring(0,displayLimit) + "..." : displayString;
                    memberHTML = '<li class="acfb-data" name="'+ m.userId +'">' +
                             ' <img alt="Remove" title="Remove" src="' + images.src.autocompleteRemoveImage + '" class="p"/>' +
                             '<input type="hidden" value="'+m.userId+'"/>' +
                             ' <span title="'+ m.userSortName + ' (' + m.userDisplayId + ')" style="white-space:nowrap;"><nobr> ' + displayString + ' </nobr></span></li>';
                    memberDOM += memberHTML;
                }
                $("#members-list").html(memberDOM);
                $("#members-number").text(members.length);
                $("#members-number-title").text(members.length === 1 ? ui.groupNumber.titleSingular : ui.groupNumber.titlePlural);

                tableNumber.text(members.length);

                $("#members-list img").unbind("click").bind("click", _event_removeMember);
                //members list filter box
                if(members.length > 0){
                    $("[id*=members-filter]").show();
                }else{
                    $("[id*=members-filter]").hide();
                }
                $("#members-filter").unbind("keyup").bind("keyup", function(){
                    var searchParam = this.value.toLowerCase().replace(/^\s*/, "").replace(/\s*$/, ""), //Trim whitespace
                        membersDOMarray = document.getElementById("members-list").getElementsByTagName("li");
                    if(searchParam.length > 0){
                        for( var m in membersDOMarray){
                            //see if no match, then hide element
                            var memberDOM = membersDOMarray[m];
                            if( memberDOM.nodeType === 1 ){
                                if( searchParam === memberDOM.getElementsByTagName("span")[0].getAttribute("title").toLowerCase().slice(0, searchParam.length)){
                                    memberDOM.style.display = "block";
                                }else{
                                    memberDOM.style.display = "none";
                                }
                            }
                        }
                    }else{
                        //if filter param has been cleared, show all members
                        for( var n in membersDOMarray){
                            //see if no match, then hide element
                            var memberDOM = membersDOMarray[n];
                            if( memberDOM !== null && typeof(memberDOM) !== "undefined" && memberDOM.nodeType === 1 ){
                                memberDOM.style.display = "block";
                            }
                        }
                    }
                });
                $("#members-filter").trigger("keyup");
            },

            _isMemberSelected = function(username){
                var found = false;
                $("span.autocomplete-member").each(function(i, rawMember){
                    if( !found && username.toLowerCase() === $(rawMember).attr("name").toLowerCase()){
                         found = true;
                     }
                 });
                return found;
            },

            /** Any field type comparator. Use like this:
                    1. Sort by price high to low
                        homes.sort(sort_by('price', true, parseInt));
                    2. Sort by city, case-insensitive, A-Z
                        homes.sort(sort_by('city', false, function(a){return a.toUpperCase()}));
            **/

            _sortGroupsComparator = function(field, reverse, primer) {
                reverse = (reverse) ? -1 : 1;
                return function(a, b) {
                    a = a[field];
                    b = b[field];
                    if (typeof(primer) != 'undefined') {
                        a = primer(a);
                        b = primer(b);
                    }
                    if (a < b) return reverse * -1;
                    if (a > b) return reverse * 1;
                    return 0;
                };
            },

            _event_removeMember = function(){
                    var _this = this,
                    that = $(this),
                    thatBackupInfo = {
                        src: that.attr("src"),
                        title: that.attr("title")
                    },
                    parent = that.parent(),
                    parentBackupInfo = {
                        css: parent.attr("style")
                    },
                    userId = parent.find("input[type=hidden]").val();
                    that.attr("src", images.src.loadingImageTiny);
                    that.attr("title", "Removing....");
                    that.unbind("click");
                    parent.css({
                        background: "#fff"
                    });
                    _ajaxUndo = function(){
                        parent.attr("style", parentBackupInfo.css);
                        that.attr("src", thatBackupInfo.src);
                        that.attr("title", thatBackupInfo.title);
                        that.unbind("click").bind("click", _event_removeMember);
                    };
                    $.post("/direct/membership/group/" + currentGroup.groupId,
                            { action: saveActions.remove, userIds: userId },
                            function(){
                                _this.src = images.src.undo;
                                that.attr("title", "Undo");
                                parent.find("span").css("text-decoration","line-through");
                                var fadeoutMember = setTimeout( function(){
                                    parent.fadeOut(function(){
                                        parent.remove();
                                    });
                                }, afterRemovalTime);

                                that.unbind("click").bind("click", function(){
                                    _event_removeMemberUndo(_this, that, parent, fadeoutMember, userId);
                                });

                                //remove user from currentGroup.members and siteGroupMembers
                                for (var i = 0, il = currentGroup.length; i < il; i++) { 
                                    if(userId === currentGroup.members[i].userId ){
                                        currentGroup.members.splice(i,1);
                                    }
                                }
                                for (var n = 0, nl = siteGroupMembers.length; n < nl; n++) {
                                    if(currentGroup.groupId === siteGroupMembers[n].groupId ){
                                        siteGroupMembers[n].members = currentGroup.members;
                                    }
                                }
                                $("#members-number").text(currentGroup.members.length);
                                var tableNumber = $("tr[id=groupRow:"+currentGroup.groupId+"]").find("td[name=g-s]");
                                tableNumber.text(currentGroup.members.length);
                            });
                    return false;
                },

            //bind undo action
                _event_removeMemberUndo = function(_this, that, parent, fadeoutMember, userId){
                    clearTimeout(fadeoutMember);
                    var thatBackupInfo = {
                        src: _this.src,
                        title: that.attr("title")
                    };
                    _this.src = images.src.loadingImageTiny;
                    that.attr("title", "Restoring....");
                    that.unbind("click");
                    _ajaxUndo = function(){
                        var fadeoutMember = setTimeout( function(){
                            parent.fadeOut(function(){
                                parent.remove();
                            });
                        }, 30000);
                        _this.src = thatBackupInfo.src;
                        that.attr("title", thatBackupInfo.title);
                        that.unbind("click").bind("click", function(){
                            _event_removeMemberUndo(_this, that, parent, fadeoutMember,userId);
                        });
                    };
                    $.post("/direct/membership/group/" + currentGroup.groupId, {action: saveActions.add, userIds: userId},
                            function(){
                                parent.find("span").css("text-decoration", "");
                                _this.src = images.src.autocompleteRemoveImage;
                                parent.css({
                                    background: "#DEE7F8"
                                });
                                that.attr("title", "Remove");
                                that.unbind("click").bind("click", _event_removeMember);
                                //refresh group members list
                                _updateMembersForGroup(currentGroup.groupId, function(){
                                    for (var i = 0, il = siteGroupMembers.length; i < il; i++) { 
                                        if(currentGroup.groupId === siteGroupMembers[i].groupId ){
                                            currentGroup.members = siteGroupMembers[i].members;
                                        }
                                    }
                                    $("#members-number").text(currentGroup.members.length);
                                    var tableNumber = $("tr[id=groupRow:"+currentGroup.groupId+"]").find("td[name=g-s]");
                                    tableNumber.text(currentGroup.members.length);
                                });
                            });
                },
                _event_undoAction = function(backedUpUserIds){
                    $("#members-number").append(images.loadingImage);
                    $("#doAction").attr("disabled", "disabled");
                    $("div.doAction").append(images.loadingImage);

                    _ajaxUndo = function(){
                        $("#doAction").attr("disabled", "");
                        $("img.img-loading").remove();
                    };
                    $.post("/direct/membership/group/" + currentGroup.groupId, {action: saveActions.update, userIds: backedUpUserIds.toString()},
                            function(){
                                _updateMembersForGroup(currentGroup.groupId, function(){
                                    for (var i = 0, il = siteGroupMembers.length; i < il; i++) { 
                                        if(currentGroup.groupId === siteGroupMembers[i].groupId ){
                                            currentGroup.members = siteGroupMembers[i].members;
                                        }
                                    }
                                    _doMembershipDOM( currentGroup.groupId);
                                });
                                $("#action-group-success span").html('The last action was undone.');
                                $("a.img-undo").hide();
                                $("#action-group-success").show();
                                $("div.doAction img.img-loading").remove();
                                $("#doAction").attr("disabled", "");
                            });
                    return false;
                },

            //bind group edit action
            _bindEditGroupLink = function(){

                var thatRow = $(this).parents("tr[name=g-r]");
                if ( typeof thatRow === "undefined" ){
                    alert("An internal error occured, the view will be refreshed.");
                    window.location.reload();
                }
                var groupId = thatRow.find("input[name=g-id]").val(),
                groupTitle = thatRow.find("td[name=g-n] a").text(),
                groupDescription = thatRow.find("td[name=g-d]").text();

                if (groupDescription.length > 0){
                    for (var g = 0, gl = siteGroups.length; g < gl; g++) {
                        if ( groupId === siteGroups[g].id){
                            groupDescription = siteGroups[g].description;
                        }
                    }
                }

                currentGroup.groupId = groupId;
                currentGroup.groupTitle = groupTitle;
                currentGroup.groupDescription = groupDescription;
                //clear current group members before population
                currentGroup.selectedMembers = [];
                currentGroup.members = [];

                if( groupId !== null ){
                    //populate this groups members' details
                    for (var i = 0, il = siteGroupMembers.length; i < il; i++) { 
                        if (groupId === siteGroupMembers[i].groupId && siteGroupMembers[i].members.length > 0){
                            if ( siteGroupMembers[i].members[0].userDisplayId === null &&  siteGroupMembers[i].members[0].userSortName === null){
                                //this group's member details have not been populated yet, populate now
                                for (var m = 0, ml = siteGroupMembers[i].members.length; m < ml; m++) {
                                    for (var g = 0, gl = siteMembers.length; g < gl; g++) {
                                        if ( siteMembers[g].userId === siteGroupMembers[i].members[m].userId){
                                            var memberFull = siteMembers[g],
                                            member = {
                                                "userId": memberFull.userId,     //Uuid
                                                "userDisplayId": memberFull.userDisplayId, //eg Staffnumber
                                                "userSortName": memberFull.userSortName
                                            };
                                            siteGroupMembers[i].members[m] = member;
                                        }
                                    }
                                }
                            }
                            currentGroup.members = siteGroupMembers[i].members;
                        }
                    }

                    //clear member filter box
                    $("#members-filter").val("");

                    _doMembershipDOM(currentGroup.groupId);

                    //attach event listeners to members
                }

                //show current membership in DOM

                // Create autocomplete object
                if(! initedAutocomplete ){
                    // allow members to be selected using userSortName, userDisplayId only
                    $("#group-current-members-autocomplete").autoCompletefb({
                            urlLookup  : siteMembers,
                            acOptions  : {
                                minChars: 1,
                                matchContains:  true,
                                selectFirst:    false,
                                width:  400,
                                max: 15,
                                formatItem: function(member) {
                                    return member.userSortName + ' (' + member.userDisplayId + ')';
                                }
                            },
                            foundClass : ".acfb-data",
                            inputClass : ".acfb-input",
                            deleteImage: images.src.autocompleteRemoveImage
                    });
                    initedAutocomplete = true;
                }else{
                    //clear current selection
                    $("#group-current-members-autocomplete li").remove();
                    $("input.acfb-input").val("");
                }

                //reveal Edit Group layer
                $("#group").show();

                 //change page title to grp title
                 $("#group-title").text(groupTitle);

                //init inline edit only once
                if ( inlineEditors.length === 0 ){
                    _initInlineEdit();
                }

                _initInlineEdit.reset();

                 if(groupDescription.length > 0){
                    $("#group-description").text(groupDescription);
                 }
                 //hide groups list view
                 $("div.group-list-body").hide();

                _event_resizeFrame();

            },

            //handle edit group title/description form
            _event_editActualGroup = function(){
                //clear any selected users/input
                $("#errors").hide();
                $("input.acfb-input").val("");
                $("#group-members-paste").val("");
                $("#group-current-members-autocomplete li").remove();
                currentGroup.selectedMembers = [];

                var buttonDo = $("#doGroupAction"),
                buttonsParent = $(".doGroupAction");
                $("#nav-create-group").hide();
                $("#form-group-title").val("");
                $("#form-group-description").val("");

                $("#groups").hide();
                $("#group").hide();
                $("#edit-form").show();

                buttonsParent.find("input").attr("disabled", "");
                $("img.img-loading").remove();

                _event_resizeFrame();

                buttonDo.unbind("click").bind("click", function(){

                    var domTitle = $("#form-group-title"),
                    domDescription = $("#form-group-description");
                    //validate title
                    if( blankREG.test( domTitle.val() )){
                        domTitle.parent().addClass("alertMessage");
                        alert("You need to specify the group title.");
                        return false;
                    }else if ( domTitle.val().length > 99){
                        //Service restricts title from being > 99 chars
                        domTitle.parent().addClass("alertMessage");
                        alert("Title length cannot exceed 99 characters. Please provide a shorter title.");
                        return false;
                    }else{
                        domTitle.parent().removeClass("alertMessage");
                    }

                    var currentGroupCopy = {
                        groupId: null,
                        groupTitle: domTitle.val(),
                        groupDescription: domDescription.val()
                    },
                    fnBeforeSend = function(){
                        buttonsParent.find("input").attr("disabled", "disabled");
                        buttonsParent.append(images.loadingImage);
                    };
                    _doSaveActualGroup(currentGroupCopy, fnBeforeSend, undefined);

                });
            },
    
            _doSaveActualGroup = function(currentGroupCopy, fnBeforeSend, fnAfterSend){
                var url = "/direct/site/" + siteId + "/group",
                params = { "groupTitle": currentGroupCopy.groupTitle, "groupDescription": currentGroupCopy.groupDescription === null ? "" : currentGroupCopy.groupDescription},
                isNewGroup = currentGroupCopy.groupId === null;
                $.ajax({
                    url: ( isNewGroup ? url : url + "/" + currentGroup.groupId ) + ".json?" + $.param(params),
                    type:  isNewGroup ? "PUT" : "POST",
                    dataType: "json",
                    beforeSend: typeof fnBeforeSend !== "undefined" ? fnBeforeSend : function(){},
                    success: function(group){
                        //add/update group properties in memory
                        currentGroup.groupId = group.id;
                        currentGroup.groupTitle = group.title;
                        currentGroup.groupDescription = group.description;
                        //clear current group members before population
                        currentGroup.selectedMembers = [];
                        currentGroup.members = [];

                        if ( group.users !== null || group.users.length > 0){
                            for (var n = 0, nl = group.length; n < nl; n++) {
                              var memberUserId = group.users[n],
                              member = {
                                  "userId": memberUserId,     //Uuid
                                  "userDisplayId": null, //memberFull.userDisplayId, eg Staffnumber will populate later
                                  "userSortName": null //memberFull.userSortName  will populate later
                              };
                              currentGroup.members.push( member );
                            }
                         }

                        if (! isNewGroup ){
                            for (var i = 0, il = siteGroups.length; i < il; i++) { 
                                if ( siteGroups[i].id === currentGroup.groupId ){
                                    siteGroups[i].title = currentGroup.groupTitle;
                                    siteGroups[i].description = currentGroup.groupDescription;
                                    siteGroups[i].members = currentGroup.members;
                                }
                            }
                            //sort and refresh list table
                            _event_showBindTableGroups();
                        }else{
                            //new item
                            var simpleGroup = {
                                "id": currentGroup.groupId,
                                "title": currentGroup.groupTitle,
                                "description": currentGroup.groupDescription
                            };
                            siteGroups.push(simpleGroup);

                            //sort and refresh list table
                            _event_showBindTableGroups();
                            //navigate to group edit membership view
                            $("#groups").hide();
                            $("#edit-form").hide();
                            $("#edit-form input[type=text]").val("");
                            $("#edit-form textarea").val("");
                            $("div.group-list-body").hide();
                            $("tr[id=groupRow:" + currentGroup.groupId + "] td[name=g-n] a").parents(":hidden").show();
                            $("tr[id=groupRow:" + currentGroup.groupId + "] td[name=g-n] a").click();
                            //clear any selected users/input
                            $("input.acfb-input").val("");
                            $("#group-members-paste").val("");
                            $("#group-current-members-autocomplete li").remove();
                            currentGroup.selectedMembers = [];
                            currentGroup.members = [];
                        }
                        if (typeof fnAfterSend !== "undefined"){
                            fnAfterSend();       
                        }
                        _event_resizeFrame();
                    }
                });
            },

            // Initialize all simple inline edit components present on the inline-edit
            _initInlineEdit = function () {
                inlineEditors = fluid.inlineEdits(".editActualGroupWrapper", {
                    selectors: {
                        text: ".editActualGroup",
                        editables : "div.editActualGroupParent, h3"
                    },/*
                    componentDecorators: {
                        type: "fluid.undoDecorator"
                    },*/
                    useTooltip: true,
                    tooltipText: "Click to edit.",
                    tooltipDelay: 500,
                    defaultViewText: "Click to add a description",
                    applyEditPadding: false,

                    editModeRenderer: function (that) {
                        if (that.editContainer.length > 0 && that.editField.length > 0) {
                            return {
                                container: that.editContainer,
                                field: that.editField
                            };
                        }
                        // Template strings.
                        var editModeTemplate= "<span><input type='text' class='flc-inlineEdit-edit fl-inlineEdit-edit'/></span>",
                        editModeTemplateType = "input";

                        if (that.viewEl[0].id === "group-description"){
                            editModeTemplate = "<span><textarea rows='7' cols='60' class='flc-inlineEdit-edit fl-inlineEdit-edit' /></span>";
                            editModeTemplateType = "textarea";
                        }

                        // Create the edit container and pull out the textfield.
                        var editContainer = $(editModeTemplate);
                        var editField = $(editModeTemplateType, editContainer);

                        var componentContainerId = that.container.attr("id");
                        // Give the container and textfield a reasonable set of ids if necessary.
                        if (componentContainerId) {
                            var editContainerId = componentContainerId + "-edit-container";
                            var editFieldId = componentContainerId + "-edit";
                            editContainer.attr("id", editContainerId);
                            editField.attr("id", editFieldId);
                        }

                        // Inject it into the DOM.
                        that.viewEl.after(editContainer);

                        // Package up the container and field for the component.
                        return {
                            container: editContainer,
                            field: editField
                        };
                    },

                    listeners: {
                        afterBeginEdit: function(){
                            if ($("#group-description-title").parent().find("textarea:visible").length > 0){
                                $("#group-description-title").css("display", "block");
                            }
                            _event_resizeFrame();
                        },
                        //onBeginEdit: function(){},
                        //modelChanged: function(){},
                        //afterInitEdit: function(){},
                        onFinishEdit: function(newValue, oldValue, editNode, viewNode){
                            //console.log("modelChanged");
                            //console.log(newValue, oldValue, editNode, viewNode);
                            var currentGroupCopy = currentGroup,
                            fnBeforeSend = function(){
                              editNode.style.disabled = "disabled";
                              $(images.loadingImage).insertBefore($(editNode));
                            },
                            fnAfterSend = function(){
                                editNode.style.disabled = false;
                                $(editNode).parent().find("img.img-loading").remove();
                            };

                            if (viewNode.id === "group-description"){
                                if( blankREG.test( newValue )){
                                    currentGroupCopy.groupDescription = "";
                                    //$(viewNode).text("");
                                }else if ( newValue !== oldValue){
                                    currentGroupCopy.groupDescription = newValue;
                                }
                                _doSaveActualGroup(currentGroupCopy, fnBeforeSend, function(){
                                    fnAfterSend();
                                });
                            }else
                            if (viewNode.id === "group-title"){
                                if( blankREG.test( newValue )){
                                    ///editNode.addClassName("alertMessage");
                                    alert("You need to specify the group title.");
                                }else if ( newValue.length > 99){
                                    //Service restricts title from being > 99 chars
                                    ///editNode.addClassName("alertMessage");
                                    alert("Title length cannot exceed 99 characters. Please provide a shorter title.");
                                }else if ( newValue !== oldValue){
                                    currentGroupCopy.groupTitle = newValue;
                                    _doSaveActualGroup(currentGroupCopy, fnBeforeSend, fnAfterSend);
                                }
                            }
                        },
                        afterFinishEdit: function(newValue, oldValue, editNode, viewNode){
                            if (blankREG.test( newValue ) && viewNode.id === "group-title"){
                                $(viewNode).text(currentGroup.groupTitle);
                            }else{
                                $("#group-description-title").css("display", "inline");
                            }
                            _initInlineEdit.reset();
                            _event_resizeFrame();
                        }
                    }

                });
            },

            _initInlineEdit.reset = function(){
                //reset the inline editors
                for (var ed = 0, edl = inlineEditors.length; ed < edl; ed++) {
                    var fluid_that = inlineEditors[ed];
                    if ( fluid_that.viewEl[0].id === "group-description"){
                        fluid_that.model.value = currentGroup.groupDescription === null || currentGroup.groupDescription.length === 0 ? "" : currentGroup.groupDescription;
                    }else{
                        fluid_that.model.value = currentGroup.groupTitle === null || currentGroup.groupTitle.length === 0 ? "" : currentGroup.groupTitle;
                    }
                    fluid_that.refreshView();
                }
            },

            _fixGroupDescriptionLength = function(description){
                if ( typeof description !== "undefined" && description !== "" && description !== null ){
                    if ( description.length > 150 ){
                        description = description.substring(0, 150);
                        description = description.replace(/\w+$/, "") + " ...";
                    }
                }
                return description;
            },

            //resize iframe
            _event_resizeFrame = function(){
                window.onload();
                $("#errors").hide();
            },

            //Error handling
            _errorStop = function(e, showRetryLink){
                var errorsDom = $("#errors");
                errorsDom.text(e).removeClass().addClass("alertMessage").show();
                $("#groups").hide();
                $("#group").hide();
                $("#edit-form").hide();
                // stop all ajax requests
                // stop all function execution
                if ( typeof showRetryLink !== "undefined" && showRetryLink){
                    errorsDom.append('<br /><br /><a href="javascript:location.reload();">Retry</a>');
                }
            };

    return {
            //filter those in groups already in object
            sakai: {
                getSiteMembers: siteMembers,
                getSiteRoles: siteRoles,
                errorStop: function(e){
                    _errorStop(e);
                },
                saveGroup: {
                    add: function(){
                       _saveGroup(saveActions.add);
                    },
                    replace: function(){
                        _saveGroup(saveActions.update);
                    },
                    remove: function(){
                        _saveGroup(saveActions.remove);
                    }
                }
            },
            init: function(){
                try {
                    siteId = $("#siteId").text();
                    //preload icons. Dimensions are not important
                    var preload = new Image();
                    for (var key = 0, keyl = images.src.length; key < keyl; key++) {
                       preload.src = images.src[key];
                    }
                    //ajax globals
                    $.ajaxSetup({
                        async: false,
                        beforeSend: function(){
                            $("#action-group-success").hide();
                        },
                        complete: function(){
                            ajaxCustomErrorMsg = null;
                            _ajaxUndoBefore = function(){};
                            _ajaxUndo = function(){};
                        },
                        error: function(xhr) {
                            _ajaxUndoBefore();
                            if( ajaxCustomErrorMsg === null){
                                alert("Oops, the server could not process your action due to this error: " + xhr.statusText + " (" + xhr.status + ").");
                            }else{
                                alert(ajaxCustomErrorMsg + "\n\n Error: " + xhr.statusText + " (" + xhr.status + ").");
                            }
                            _ajaxUndo();
                            return false;
                        }
                    });
                    _getSiteUsersAndGroups();

                    //Navigation
                    $("#nav-create-group").unbind("click").bind("click", _event_editActualGroup);

                    $("#nav-edit-actual-group").unbind("click").bind("click", function(){
                        if(currentGroup.selectedMembers.length > 0 || $("#group-members-paste").val().length > 0 || $("#group-current-members-autocomplete li").length > 0){
                            if( confirm("You have made changes to this page. Are you sure you want to proceed without saving?") ){
                                _event_editActualGroup();
                            }else{
                                return false;
                            }
                        }else{
                            _event_editActualGroup();
                        }
                    });

                    $("#form-group-title")
                            .change(function(e) {
                                $(this).keypress();
                            })
                            .keyup(function(e) {
                                $(this).keypress();
                            })
                            .keydown(function(e) {
                                $(this).keypress();
                            })
                            .focus(function(e) {
                                $(this).keypress();
                            })
                            .click(function(e) {
                                $(this).keypress();
                            })
                                    .keypress(function(e) {
                         //clear the alert class
                        var domTitle = $(this);
                        if (domTitle.val().length > 0){
                            domTitle.parent().removeClass("alertMessage");
                        }
                    });


                    $(".nav-list").unbind("click").bind("click", function(){
                        $("#action-group-success").hide();
                        var gotoFn = function(){
                            //re-select add option
                            $("input[id=action.a]").attr("checked","checked");
                            //clear any selected users/input
                            $("input.acfb-input").val("");
                            $("#group-members-paste").val("");
                            $("#group-current-members-autocomplete li").remove();
                            currentGroup.selectedMembers = [];

                            //show list n hide whatever is visible
                            $("#nav-create-group").show();
                            $("#group").hide();
                            $("#groups").show();
                            $("#edit-form").hide();
                            $("#edit-form input[type=text]").val("");
                            $("#edit-form textarea").val("");
                            $("div.group-list-body").show();
                            _event_resizeFrame();
                            if ( $("#errors").attr("class") === "information" && $("#groups-selector tr[name=g-r]").length === 0){
                                $("#errors").show();
                            }else{
                                $("#errors").hide();
                            }
                        };
                        if(currentGroup.selectedMembers.length > 0 || $("#group-members-paste").val().length > 0 || $("#group-current-members-autocomplete li").length > 0){
                            if( confirm("You have made changes to this page. Are you sure you want to proceed without saving?") ){
                                gotoFn();
                            }else{
                                return false;
                            }
                        }else{
                            gotoFn();
                        }
                        return false;
                    });

                    //focus on autocomplete textbox
                    $("input.acfb-input").focus();
                    $(".searchBoxParent").unbind("click").bind("click", function(){
                        $("input.acfb-input").focus();
                    });

                }catch(error){
                    if (debug){
                        throw error;
                    }else{
                        _errorStop("Oops, the browser failed to excecute a javascript call. Click try again or seek technical assistance.", true);
                        return false;
                    }
                }
            },
            //debug helper:
            searchForUser: function(uId){
                 var found = false;
                for( var b in siteMembers ){
                    if( !found && uId !== null & uId.toLowerCase() === siteMembers[b].userDisplayId ){
                        //member is valid
                        found = true;
                        currentGroup.selectedMembers.push(siteMembers[b].userId);
                    }
                }
            },
            isMemberSelected: function(username){
                return _isMemberSelected(username);
            },
            resizeFrame: function(){
                _event_resizeFrame();
            }
    };
}(jQuery, fluid);

//initialise group manager
$(document).ready(function() {
    sakai.groups.manager.init();
});