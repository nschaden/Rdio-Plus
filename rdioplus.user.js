// ==UserScript==
// @name        Rdio Plus
// @namespace   http://nickschaden.com
// @description Extra Rdio.com controls with your keyboard, playlist flexibility and a full screen visualizer.
// @include     *www.rdio.com*
// @author      Nick Schaden
// @version     0.7
// ==/UserScript==

var ExtraControls = function($)
{
	var exports = {};
	
	function getAjaxPrefixURL()
	{
		var result = /.*\#/.exec(document.location.href);
		if (typeof result == 'object')
			return result[0];
		else
			return false;
	}
	
	function getHomeURL()
	{
		return $('#header a:contains(Dashboard)').attr('href');
	}
	
	function getCollectionURL() 
	{
        return $('#header a:contains(Collection)').attr('href');
    }
	
	function getPlaylistsURL()
	{
		return $('#header a:contains(Playlists)').attr('href');
	}
	
	function jumpToNewURL(newsuffix)
	{
		var ajaxbase = getAjaxPrefixURL();
		if (typeof ajaxbase != 'string' || typeof newsuffix != 'string') 
			return;
		else
			document.location.href = ajaxbase + newsuffix;
	}
	
	function keyCheck(event)
	{
		var ajaxprefix, collection, playlists, searchinput;
		
		// for Cmd + Shift + C, jump to collection
		if (event.shiftKey && event.metaKey && event.keyCode == 99)
		{
			event.preventDefault();
			jumpToNewURL(getCollectionURL());
		}
		
		// for Cmd + Shift + F, jump to collection
		if (event.shiftKey && event.metaKey && event.keyCode == 102)
		{
			if (typeof QuickAdd == 'object' && typeof QuickAdd.fullScreenContainer == 'object')
			{
				event.preventDefault();

				if ($('#fullscreen_container').length > 0)
					// visible, so get out of this mode
					QuickAdd.hideFullScreenMode();			
				else
					QuickAdd.showFullScreenMode();
			}
		}
		
		// for Cmd + Shift + H, jump to home/dashboard
		if (event.shiftKey && event.metaKey && event.keyCode == 104)
		{
			event.preventDefault();
			jumpToNewURL(getHomeURL());
		}
		
		// for Cmd + Shift + L, jump focus to search box
		if (event.shiftKey && event.metaKey && event.keyCode == 108)
		{
			searchinput = $('#searchInput');
			if (searchinput.length > 0)
				searchinput.focus();
		}
		
		// for Cmd + Shift + M, jump to queue
		if (event.shiftKey && event.metaKey && event.keyCode == 109)
		{
			event.preventDefault();
			jumpToNewURL(getHomeURL() + 'queue/');
		}
		
		// for Cmd + Shift + N, jump to history
		if (event.shiftKey && event.metaKey && event.keyCode == 110)
		{
			event.preventDefault();
			jumpToNewURL(getHomeURL() + 'history/');
		}
		
		// for Cmd + Shift + P, jump to playlists
		if (event.shiftKey && event.metaKey && event.keyCode == 112)
		{
			event.preventDefault();
			jumpToNewURL(getPlaylistsURL());
		}
		
		// for Cmd + Shift + X, toggle shuffle
		if (event.shiftKey && event.metaKey && event.keyCode == 120)
		{
			var shuffle = $('#shuffle_button');
			if (shuffle.length > 0)
				shuffle.click();
		}
		
		// for Cmd + Shift + Z, toggle repeat
		if (event.shiftKey && event.metaKey && event.keyCode == 122)
		{
			var repeat = $('#repeat_button');
			if (repeat.length > 0)
				repeat.click();
		}
		
		// for Cmd + Shift + , toggle help screen
		if (event.shiftKey && event.metaKey && event.keyCode == 44)
		{
			var extracontrols = $('#extracontrols_help');
			if (extracontrols.css('display') == 'none')
				extracontrols.fadeIn('slow');
			else
				extracontrols.fadeOut('slow');
		}
	}
	
	$(window).keypress(function(event) 
	{
		keyCheck(event);
	});
	
	exports.getAjaxPrefixURL = getAjaxPrefixURL;
	exports.getCollectionURL = getCollectionURL;
	exports.getHomeURL = getHomeURL;
	exports.getPlaylistsURL = getPlaylistsURL;
	exports.jumpToNewURL = jumpToNewURL;
	exports.keyCheck = keyCheck;
	return exports;
};

var QuickAdd = function($)
{

	var exports = {};
	var currentAlbum;
	var currentAlbumArtLargePath;
	var currentUser;
	var currentPlaylist;
	var currentTrackids;
	var currentTrackIndex;
	var fullScreenContainer;
	var fullScreenModeTimer;
	var statusTimer;
	var nowplayingDialogInit = false;
	var overlayScreen;
	var playlistDialog;
	var playlistDialogMode;
	var playlistDialogInit = false;
	var playlistDialogRefresh = false;
	
	// Rdio views are loaded via ajax.  We can use the ajaxComplete event as a
	// cue to check see if the proper album or artist view has just been loaded.
    $(document).bind('ajaxComplete', function() 
	{
        displayAddAlbumButton();
		displayAddArtistButton();
		if (!QuickAdd.playlistDialogInit)
		{
			QuickAdd.playlistDialogInit = true;
			QuickAdd.initPlaylistDialog();
			QuickAdd.initFullScreenMode();
		}
		if (QuickAdd.playlistDialogRefresh && (!(/playlists\/.+/.test(document.location.href))))
		{
			QuickAdd.playlistDialogRefresh = false;
			QuickAdd.refreshPlaylistDialogPlaylists();
		}
		// especially annoying, but for now, check the document URL, if we are on a playlist page,
		// bind a click on a playlist to refresh the add to playlist dialog selection
		if (/playlists\/.+/.test(document.location.href))
		{
			QuickAdd.playlistDialogRefresh = true;
		}
		// ditto here, no efficient way to intercept when now playing dialog is shown, so check 
		// after user clicks the button or presses the keypress 
		if (!QuickAdd.nowplayingDialogInit)
		{
			QuickAdd.nowplayingDialogInit = false;
			
			$('#flyout_button').one('click',function() 
			{ 
				QuickAdd.displayAddNowPlayingToPlaylistLink();
			});
		}
		
    });

	function addIndicatorMessage(text)
	{
		if ($('#loading_indicator').length > 0)
		{
			var lindicator = $('#loading_indicator_extra');
			if (lindicator.length == 0)
			{
				lindicator = $('<div id="loading_indicator_extra" style="border: 1px 0 solid #000; background: -webkit-gradient(linear, 0% 0%, 0% 100%, from(#475B64), to(#20343f)); border-top-left-radius: 10px; border-bottom-left-radius: 10px; display: none; position: fixed; right: 0; top: 0; z-index: 15000; text-shadow: rgba(0, 0, 0, 0.597) 1px 1px 1px; color: #fff; font-size: 12px; font-weight: bold; height: 20px; line-height: 20px; margin: 16px 0 0; padding: 5px 15px;"></div>');
				$('#loading_indicator').after(lindicator);
			}
			clearTimeout(QuickAdd.statusTimer);
			lindicator.text(text);
			lindicator.stop(true,true).fadeIn(400,function()
			{
				QuickAdd.statusTimer = setTimeout(function() { $('#loading_indicator_extra').stop(true,true).fadeOut(400); },3000);
			});
		}
	}
	
	function addToPlayListLoop()
	{
		if (QuickAdd.currentTrackIndex >= QuickAdd.currentTrackids.length)
		{ 
			QuickAdd.addIndicatorMessage('Added ' + QuickAdd.currentTrackids.length + ' tracks to playlist ' + QuickAdd.currentPlaylist.name);
			QuickAdd.refreshPlaylistDialogPlaylists();
		}
		else
		{
			QuickAdd.addToPlaylist(QuickAdd.currentPlaylist,QuickAdd.currentTrackids[QuickAdd.currentTrackIndex],function(data)
			{
				QuickAdd.currentTrackIndex += 1;
				QuickAdd.addToPlayListLoop();
			});
		}
	}
	
	function addToPlaylist(playlist, song, callback) 
	{
        $.getJSON('/api/json/addToPlaylist/', 
		{
            id: playlist.id || playlist,
            song: song.id || song
        }, function(isSuccess) 
		{
            callback(isSuccess);
        });
    }

	function addTracksFromCurrentAlbumToPlaylist(playlist)
	{
		if (typeof playlist == 'undefined') return false;
		QuickAdd.currentPlaylist = playlist;
		QuickAdd.currentTrackids = [];
		var albumurl = getCurrentAlbumURL();
		if (!albumurl) return false;
		var returnedalbumdetails;
		QuickAdd.addIndicatorMessage('Adding album to playlist ' + playlist.name + '...');
		$.getJSON(albumurl,function(data) 
		{ 
			returnedalbumdetails = data;
			if (typeof returnedalbumdetails != 'object') return false;
			QuickAdd.currentTrackids = returnedalbumdetails.content.content.data.album.track_ids;
			QuickAdd.currentTrackIndex = 0;
			QuickAdd.addToPlayListLoop();
			return true;
		});
		return true;
	}
	
	function addTracksFromCurrentArtistToPlaylist(playlist)
	{
		if (typeof playlist == 'undefined') return false;
		QuickAdd.currentPlaylist = playlist;
		QuickAdd.currentTrackids = [];		
		var artisturl = getCurrentArtistURL();
		if (!artisturl) return false;
		var returnedartistdetails;
		QuickAdd.addIndicatorMessage('Adding artist to playlist ' + playlist.name + '...');
		$.getJSON(artisturl,function(data) 
		{ 
			returnedartistdetails = data;
			if (typeof returnedartistdetails != 'object') return false;
			var topalbums = returnedartistdetails.content.content.data.top_albums;
			for (var i = 0; i < topalbums.length; i++)
			{
				QuickAdd.currentTrackids = QuickAdd.currentTrackids.concat(topalbums[i].track_ids);
			}
			QuickAdd.currentTrackIndex = 0;
			QuickAdd.addToPlayListLoop();
			return true;
		});
		return true;
	}
	
	function addTracksFromCurrentAlbumToPlaylistName(name,description)
	{
		var returnlist;
		getPlaylist(name || 'Quick',function(data) 
		{ 
			returnlist = data;
			if (typeof returnlist != 'object')
			{
				if (typeof description != 'string' || description.length == 0)
					description = ' ';
				createPlaylist(name || 'Quick',0,description,function(data2)
				{
					if (data2)
						addTracksFromCurrentAlbumToPlaylistName(name || 'Quick');
				});
			}
			else
				(addTracksFromCurrentAlbumToPlaylist)(returnlist);
		});
	}
	
	function addTracksFromCurrentArtistToPlaylistName(name,description)
	{
		var returnlist;
		getPlaylist(name || 'Quick',function(data) 
		{ 
			returnlist = data;
			if (typeof returnlist != 'object')
			{
				if (typeof description != 'string' || description.length == 0)
					description = ' ';
				createPlaylist(name || 'Quick',0,description,function(data2)
				{
					if (data2)
						addTracksFromCurrentArtistToPlaylistName(name || 'Quick');
				});
			}
			else
				addTracksFromCurrentArtistToPlaylist(returnlist);
		});
	}
	
	function addTracksFromNowPlayingToPlaylist(playlist)
	{
		if (typeof playlist == 'undefined') return false;
		QuickAdd.currentPlaylist = playlist;
		QuickAdd.currentTrackids = [];
		// for case where now playing is just a single track
		var tracks = $('#now_playing_dialog .now_playing .single_track');
		if (tracks.length == 0)
			tracks = $('#now_playing_dialog .now_playing .track');
		if (tracks.length == 0) return false;
		for (var i = 0; i < tracks.length; i++)
		{
			var trackspan = $(tracks[i]).find('span[class*="menu_sus"]');
			var searchresult = /(^t(\d*)|\s+t(\d*))/.exec(trackspan.attr('class'));
			if (searchresult != null && searchresult.length == 4)
			{
				if (typeof searchresult[2] == 'string')
					QuickAdd.currentTrackids.push(parseInt(searchresult[2],10));
				else if (typeof searchresult[3] == 'string')
					QuickAdd.currentTrackids.push(parseInt(searchresult[3],10));
			}
		};
		QuickAdd.addIndicatorMessage('Adding Now Playing to playlist ' + playlist.name + '...');
		if (QuickAdd.currentTrackids.length == 0) return false;
		QuickAdd.currentTrackIndex = 0;
		QuickAdd.addToPlayListLoop();
		return true;
	}
	
	function addTracksFromNowPlayingToPlaylistName(name,description)
	{
		var returnlist;
		getPlaylist(name || 'Quick',function(data) 
		{ 
			returnlist = data;
			if (typeof returnlist != 'object')
			{
				if (typeof description != 'string' || description.length == 0)
					description = ' ';
				createPlaylist(name || 'Quick',0,description,function(data2)
				{
					if (data2)
						addTracksFromNowPlayingToPlaylistName(name || 'Quick');
				});
			}
			else
				addTracksFromNowPlayingToPlaylist(returnlist);
		});
	}
	
	function createPlaylist(name, song, description, callback) 
	{
        if (typeof description == 'function') 
		{
            callback = description;
            description = null;
        }

        $.post('/api/json/createPlaylist/', 
		{
            name: name,
            song: song.id || song,
            description: description || 'automatically generated playlist'
        }, function(isSuccess) 
		{
            callback(isSuccess);
        }, 'json');
	}
	
	function displayAddAlbumButton()
	{
		if ($('#album_menu.menu_holder').length > 0 && $('#album_add_button').length < 1)
		{
			$('#album_menu.menu_holder .menu_sus').bind('click',function() 
			{ 
				if ($('#album_add_button').length < 1)
				{
					var albumaddbutton = $('<li class="sus_item"><a id="album_add_button" class="sus_link">Add to Playlist...</a></li>');

					albumaddbutton.click(function() {
						showPlaylistDialog('Add ' + $('.artist_header .header_text').text().trim() + ' to','album');
						return true;
					});

					$(this).find('.sus_list .sus_item:last').before(albumaddbutton);
				}
			});		
		}
	}
	
	function displayAddArtistButton()
	{
		if ($('.profile_header .header_tab_bar').length > 0 && $('#artist_add_button').length < 1)
		{
			if ($('.profile_header.is_self').length > 0 || $('.artist_header').length == 0) return;
			var artistaddbutton = $('<span class="tab" id="artist_add_button"><a href="#"><span class="left_cap"></span><span class="tab_title">Add to Playlist...</span><span class="right_cap"></span>');

			artistaddbutton.click(function() {
				showPlaylistDialog('Add ' + $('.artist_header .name').text().trim() + ' to','artist');
				return false;
			});

			if ($('.artist_header .name').length > 0)
				$('.artist_header .name').css('width','370px');
			$('.profile_header .header_tab_bar').prepend(artistaddbutton);	
		}
	}
	
	function displayAddNowPlayingToPlaylistLink()
	{
		if ($('#now_playing_dialog').length > 0)
		{
			var content = $('#now_playing_dialog .accordion_content.now_playing');
			if (content.length > 0)
			{
				var header = content.siblings('.accordion_header');
				if (header.length > 0 && header.find('a').length == 0)
				{
					var addtolistlink = $('<a href="#" class="more_link">Add to Playlist</a>');
					addtolistlink.click(function()
					{
						$('#flyout_button').trigger('click');
						QuickAdd.showPlaylistDialog('Add Now Playing to','nowplaying');
						return false;
					});
					header.prepend(addtolistlink);
				}
			}
		}
	}

    function getCollection(callback) 
	{
        $.getJSON(getCollectionURL(), callback);
    }

	function getCollectionURL() 
	{
        return $('#header a:contains(Collection)').attr('href');
    }

	function getCurrentAlbumURL()
	{
		var result = /\#(\/artist\/.*\/album\/.*\/)/.exec(document.location.href);
		if (typeof result == 'object')
			return result[1];
		else
			return false;
	}
	
	function getCurrentAlbumArtLargePath()
	{
		var albumurl = $('#playerNowPlayingAlbum a');
		if (albumurl.length == 0) return false;
		albumurl = albumurl.attr('href');
		var returnedalbumdetails;
		$.getJSON(albumurl,function(data) 
		{ 
			QuickAdd.currentAlbumArtLargePath = data.content.content.data.album.bigIcon;
		});
		return true;
	}

	function getCurrentArtistURL()
	{
		var result = /\#(\/artist\/.*\/)/.exec(document.location.href);
		if (typeof result == 'object')
			return result[1];
		else
			return false;
	}

	function getPlaylists(callback) 
	{
	    getCollection(function(collection) 
		{
	        $.getJSON(collection.content.content.data.urls.playlists, callback);
	    });
	}

	function getPlaylist(name, callback) 
	{
	     getPlaylists(function(playlists) 
		 {
            var lists = playlists.content.content.data.playlists;

            callback(lists.filter(function(list) 
			{
                return list.name === name;
            })[0]);
	     });
	}
		
	function getSearch(q) 
	{
		var returndata;
		$.getJSON('/api/json/search/', {query: q}, function(data) { returndata = data; });
		return returndata;
	}
	
	function hideFullScreenMode()
	{
		clearTimeout(QuickAdd.fullScreenModeTimer); 
		QuickAdd.fullScreenContainer.remove(); 
		QuickAdd.overlayScreen.fadeOut('slow',function() { $(this).remove(); });
	}
	
	function initFullScreenMode()
	{
		if (!QuickAdd.fullScreenContainer)
			QuickAdd.fullScreenContainer = $('<div id="fullscreen_container" style="width: 600px; height: auto; position: absolute; top: 30px; left: 0; display: none; z-index: 1002; background: #37444b; background: -webkit-gradient(linear, 0% 0%, 0% 100%, from(#37444b), to(#28323a)); "></div>');

		var largealbumart = $('<div class="largealbumart" style="width: 600px; height: 600px; background: #000; float: left; position: relative;"><img src="" style="display: none; width: 600px; height: 600px;" alt=""/></div>');
		var navigation = $('<div class="nav" style="float: left; clear: left; display: none; padding: 20px 20px 0 20px;"><button class="prevButton" style="width: 30px; height: 30px; margin-top: 5px; float: left; cursor: pointer; margin-right: 5px; border: 0;"></button><button class="playButton" style="width: 40px; height: 41px; float: left; margin-right: 4px; border: 0; cursor: pointer;"></button><button class="pauseButton" style="width: 40px; height: 41px; float: left; margin-right: 4px; border: 0; cursor: pointer;"></button><button class="nextButton" style="width: 30px; height: 30px; margin-top: 5px; float: left; cursor: pointer; margin-right: 4px; border: 0;"></button></div>');
		var info = $('<div class="info" style="float: left; clear: left; padding: 20px;"></div>');
		var title = $('<div class="title" style="font-size: 42px; color: #fff; font-weight: bold; line-height: 1.28; max-height: 168px;"><a href="#"></a></div>');
		var artist = $('<div class="artist" style="font-size: 36px; color: #acb3b7; font-weight: bold; line-height: 1.28; max-height: 144px;"><a href="#"></a></div>');
		var album = $('<div class="album" style="font-size: 36px; color: #acb3b7; font-weight: bold; line-height: 1.28; max-height: 144px;"><a href="#"></a></div>');
		var slider = $('<div class="slider" style="width: 460px; margin: 20px 0; height: 10px; background: #000; border-radius: 6px; background: #151a1f; position: relative; float: left;"><div class="inner" style="width: 0; position: relative; float: left; height: 100%; background: #eaedec; background: -webkit-gradient(linear, 0% 0%, 0% 100%, from(#eaedec), to(#e1e4e6)); border-radius: 6px;"></div></div>');
		var time = $('<div class="time" style="width: 100px; margin-top: 5px; text-align: right; font-weight: bold; color: #fff; font-size: 30px; float: left; position: static;"></div><div class="timeleft" style="width: 100px; margin-top: 5px; text-align: right; font-weight: bold; color: #fff; font-size: 30px; float: left; position: static;"></div>');
		var nonart = $('<div class="nonart" style="width:600px; float: left; clear: left;"></div>');
		info.append(title,artist,album,slider,time);
		nonart.append(navigation,info);
		QuickAdd.fullScreenContainer.append(largealbumart,nonart);

		navigation.children().css(
		{
			'backgroundImage': $('#playButton').css('backgroundImage'),
			'backgroundColor': 'transparent',
			'backgroundRepeat': 'no-repeat'
		});
		navigation.children('.prevButton').css(
		{
			'backgroundImage' : $('#previousButton').css('backgroundImage')
		});
		navigation.children('.nextButton').css(
		{
			'backgroundImage' : $('#nextButton').css('backgroundImage')
		});
		navigation.children('.prevButton').css('backgroundPosition',$('#previousButton').css('backgroundPosition'));
		navigation.children('.playButton').css('backgroundPosition',$('#playButton').css('backgroundPosition'));
		navigation.children('.pauseButton').css('backgroundPosition',$('#pauseButton').css('backgroundPosition'));
		navigation.children('.nextButton').css('backgroundPosition',$('#nextButton').css('backgroundPosition'));

		QuickAdd.progressSlider = $('#playerTrackSlider');
		QuickAdd.progressSliderInner = QuickAdd.progressSlider.find('.progressSlider-pre');
	}
	
	function initPlaylistDialog()
	{
		var data,playlists;
		getPlaylists(function(playlists) 
		{
		    data = playlists.content.content.data.playlists;
			for (var i = 0; i < data.length; i++)
			{
				playlists += '<option>' + data[i].name + '</option>';
			}

			QuickAdd.overlayScreen = $('<div class="ui-widget-overlay" style="width: 100%; height: 100%; display: none; z-index: 1001; "></div>');

			QuickAdd.playlistDialog = $('<div style="outline-width: 0px; outline-style: initial; outline-color: initial; left: 0; top: 0; height: auto; width: 357px; display: none; z-index: 1002; " class="ui-dialog ui-widget ui-widget-content ui-corner-all " tabindex="-1" role="dialog"></div>');

			var titlebar = $('<div class="ui-dialog-titlebar ui-widget-header ui-corner-all ui-helper-clearfix" unselectable="on"><span class="ui-dialog-title" id="ui-dialog-title-add_to_playlist_dialog" unselectable="on"></span><a href="#" class="ui-dialog-titlebar-close ui-corner-all" role="button" unselectable="on"><span class="ui-icon ui-icon-closethick" unselectable="on">close</span></a></div>');

			var tabset = $('<div id="add_to_playlist_dialog" class="ui-tabs ui-widget ui-widget-content ui-dialog-content" style="width: auto; min-height: 62px; height: auto; "><ul class="ui-tabs-nav ui-helper-reset ui-helper-clearfix ui-widget-header ui-corner-all"><li class="ui-state-default ui-corner-top ui-tabs-selected ui-state-active"><a href="#My_Playlists"><span>My Playlists</span></a></li><li class="ui-state-default ui-corner-top"><a href="#Create_Playlist"><span>Create Playlist</span></a></li></ul></div>');

			var tabplaylists = $('<div id="My_Playlists" class="ui-tabs-panel ui-widget-content ui-corner-bottom"><select id="playlistSelection">' + playlists + '</select></div>');

			var tabcreate = $('<div id="Create_Playlist" class="ui-tabs-panel ui-widget-content ui-corner-bottom ui-tabs-hide"><div><span class="overlabel-wrapper"><input type="text" title="Title" class="textInput" id="playlistName"><label for="playlistName" style="line-height: normal; text-indent: 0px; cursor: text; left: 0px; " class="overlabel-apply">Title</label></span><span class="overlabel-wrapper"><textarea class="textInput" id="playlistDescription" title="Description"></textarea><label for="playlistDescription" style="line-height: normal; text-indent: 0px; cursor: text; left: 0px; " class="overlabel-apply">Description</label></span></div></div>');

			var dialogbuttons = $('<div class="ui-dialog-buttonpane ui-widget-content ui-helper-clearfix"><div class="ui-dialog-buttonset"><button type="button" class="button add default_button"><span>Add</span></button><button type="button" class="cancel button"><span>Cancel</span></button></div></div>');

			QuickAdd.playlistDialog.append(titlebar);
			QuickAdd.playlistDialog.append(tabset);
			tabset.append(tabplaylists);
			tabset.append(tabcreate);
			QuickAdd.playlistDialog.append(dialogbuttons);
			
			QuickAdd.playlistDialogMode = 'album';
			
		});
	}
	
	function refreshFullScreenMode()
	{
		QuickAdd.fullScreenInfo.children('.title').html($('#playerNowPlayingTitle').html().replace('href=','style="color: #fff;" href='));
		QuickAdd.fullScreenInfo.children('.artist').html($('#playerNowPlayingArtist').html().replace('href=','style="color: #acb3b7;" href='));
		QuickAdd.fullScreenInfo.children('.album').html($('#playerNowPlayingAlbum').html().replace('href=','style="color: #acb3b7;" href='));
		var curralbum = $('#playerNowPlayingAlbum').text();
		var curralbumimg = QuickAdd.fullScreenContainer.find('.largealbumart img');
		if (QuickAdd.currentAlbum != curralbum)
		{
			// new album playing, change cover art appropriately
			curralbumimg.stop(true,false).fadeOut('fast');
			QuickAdd.currentAlbumArtLargePath = null;
			QuickAdd.getCurrentAlbumArtLargePath();
		}
		else
		{
			if (curralbumimg.css('display') == 'none' && QuickAdd.currentAlbumArtLargePath != null)
			{
				curralbumimg.attr('src',QuickAdd.currentAlbumArtLargePath);
				setTimeout(function() { curralbumimg.stop(true,true).fadeIn('fast'); },1500);
			}
			else if (QuickAdd.currentAlbumArtLargePath != null && curralbumimg.attr('src') != QuickAdd.currentAlbumArtLargePath)
			{
				curralbumimg.attr('src',QuickAdd.currentAlbumArtLargePath);
				setTimeout(function() { curralbumimg.stop(true,true).fadeIn('fast'); },1500);
			}
		}
		QuickAdd.currentAlbum = curralbum;

		if (/stopped|offline|paused/.test($('body').attr('class')))
		{
			QuickAdd.fullScreenContainer.find('.playButton').show();
			QuickAdd.fullScreenContainer.find('.pauseButton').hide();
		}
		else
		{
			QuickAdd.fullScreenContainer.find('.playButton').hide();
			QuickAdd.fullScreenContainer.find('.pauseButton').show();
		}
		
		var navigation = QuickAdd.fullScreenContainer.find('.nav');
		
		if ($('#previousButton').hasClass('disabled'))
			navigation.children('.prevButton').addClass('disabled');
		else
			navigation.children('.prevButton').removeClass('disabled');
		navigation.children('.prevButton').css(
		{
			'backgroundPosition': $('#previousButton').css('backgroundPosition'),
			'backgroundImage' : $('#previousButton').css('backgroundImage')
		});
		
		
		if ($('#nextButton').hasClass('disabled'))
			navigation.children('.nextButton').addClass('disabled');
		else
			navigation.children('.nextButton').removeClass('disabled');
		navigation.children('.nextButton').css('backgroundPosition',$('#nextButton').css('backgroundPosition'));
		navigation.children('.nextButton').css(
		{
			'backgroundPosition': $('#nextButton').css('backgroundPosition'),
			'backgroundImage' : $('#nextButton').css('backgroundImage')
		});
			
		QuickAdd.fullScreenInfo.find('.time').text(($('#playerTrackSliderLabelValue').text()));
		QuickAdd.fullScreenInfo.find('.timeleft').text(($('#playerTrackSliderLabelTimeLeft').text()));
		QuickAdd.fullScreenInfo.find('.inner').css('width', parseInt(((QuickAdd.progressSliderInner.width()/QuickAdd.progressSlider.width())*460),10) + 'px');
		QuickAdd.fullScreenModeTimer = setTimeout(refreshFullScreenMode,500);
	}
	
	function refreshPlaylistDialogPlaylists()
	{
		var data,playlists;
		getPlaylists(function(playlists) 
		{
		    data = playlists.content.content.data.playlists;
			for (var i = 0; i < data.length; i++)
			{
				playlists += '<option>' + data[i].name + '</option>';
			}
			
			QuickAdd.playlistDialog.find('#playlistSelection').html(playlists);
		});
	}
	
	function showFullScreenMode()
	{
		$('body').append(QuickAdd.overlayScreen);
		QuickAdd.currentAlbum = "";
		QuickAdd.fullScreenInfo = QuickAdd.fullScreenContainer.find('.info');
		refreshFullScreenMode();
		$(window).scrollTop(0);
		QuickAdd.overlayScreen.css('opacity',0.9);
		QuickAdd.overlayScreen.fadeIn('slow');
		
		$('body').append(QuickAdd.fullScreenContainer);
		
		// if screen isn't too tall, but wide enough, flip to widescreen mode
		if ($(window).height() < 900 && $(window).width() >= 1200)
		{
			QuickAdd.fullScreenContainer.css('width','1200px');
			QuickAdd.fullScreenContainer.find('.nonart').css(
			{
				position: 'absolute',
				bottom: 0,
				right: 0
			});
			if (Math.floor($(window).width()/2) > 600)
				QuickAdd.fullScreenContainer.css('left',(Math.floor($(window).width()/2)-600) + 'px');
		}
		else
		{
			QuickAdd.fullScreenContainer.css('width','600px');
			QuickAdd.fullScreenContainer.find('.nonart').css(
			{
				position: 'relative',
				bottom: 'auto',
				right: 'auto'
			});
			if (Math.floor($(window).width()/2) > 300)
				QuickAdd.fullScreenContainer.css('left',(Math.floor($(window).width()/2)-300) + 'px');
		}
				
				
		if ($('#playerTrackSliderLabelValue').css('display') == 'none')
		{
			QuickAdd.fullScreenInfo.find('.time').hide();
			QuickAdd.fullScreenInfo.find('.timeleft').show();
		}
		else
		{
			QuickAdd.fullScreenInfo.find('.time').show();
			QuickAdd.fullScreenInfo.find('.timeleft').hide();			
		}
		
		QuickAdd.fullScreenContainer.delay(600).fadeIn('slow',function()
		{
				var navigation = QuickAdd.fullScreenContainer.find('.nav');
				navigation.children().css(
				{
					'backgroundImage': $('#playButton').css('backgroundImage'),
					'backgroundColor': 'transparent',
					'backgroundRepeat': 'no-repeat'
				});
				navigation.children('.prevButton').css('backgroundPosition',$('#previousButton').css('backgroundPosition'));
				navigation.children('.playButton').css('backgroundPosition',$('#playButton').css('backgroundPosition'));
				navigation.children('.pauseButton').css('backgroundPosition',$('#pauseButton').css('backgroundPosition'));
				navigation.children('.nextButton').css('backgroundPosition',$('#nextButton').css('backgroundPosition'));
				navigation.fadeIn('fast');
				
				
				// add in click controls
				$(QuickAdd.overlayScreen).click(function() { QuickAdd.hideFullScreenMode(); });
				navigation.children('.prevButton').click(function() { $('#previousButton').click(); });
				navigation.children('.playButton').click(function() { $('#playButton').click(); });
				navigation.children('.pauseButton').click(function() { $('#pauseButton').click(); });
				navigation.children('.nextButton').click(function() { $('#nextButton').click(); });
				
				QuickAdd.fullScreenInfo.children('.title,.album,.artist').click(function(e) { if (e.target.tagName == 'A') QuickAdd.hideFullScreenMode(); });
				QuickAdd.fullScreenInfo.find('.time').click(function() { QuickAdd.fullScreenInfo.find('.time').hide(); QuickAdd.fullScreenInfo.find('.timeleft').show(); });
				QuickAdd.fullScreenInfo.find('.timeleft').click(function() { QuickAdd.fullScreenInfo.find('.time').show(); QuickAdd.fullScreenInfo.find('.timeleft').hide(); });
		});
	}
	
	function showPlaylistDialog(dialogtitle,dialogmode)
	{
		// set parameters
		if (typeof dialogmode == 'undefined')
			dialogmode = 'album';
		
		if (typeof dialogtitle == 'undefined')
			dialogtitle = 'Add album to';
						
		playlistDialogMode = dialogmode;
			
		// set proper height of dialog based on current window dimensions
		var winwidth = $(window).width();
		var winheight = $(window).height();
		if (Math.floor(winwidth/2) > 178)
			QuickAdd.playlistDialog.css('left',Math.floor($(window).width()/2-178) + 'px'); 

		if (Math.floor(winheight/2) > 150)
			QuickAdd.playlistDialog.css('top',Math.floor($(window).height()/2-150) + 'px');
		// append core elements back to dom
		$('body').append(QuickAdd.overlayScreen);
		$('body').append(QuickAdd.playlistDialog);
		
		// reset to initial state
		$('#add_to_playlist_dialog ul li:first').addClass('ui-state-active');
		$('#add_to_playlist_dialog ul li:last').removeClass('ui-state-active');
		$('#Create_Playlist').addClass('ui-tabs-hide');
		$('#My_Playlists').removeClass('ui-tabs-hide');
		$('#Create_Playlist input,#Create_Playlist textarea').val('');
		$('#Create_Playlist label').show();
		$('.ui-dialog-buttonpane .add span').text('Add');
		$('.ui-dialog-title').text(dialogtitle);
		
		// attach events
		$('.ui-dialog-titlebar-close,.ui-dialog-buttonpane .cancel').click(function(){ QuickAdd.playlistDialog.remove(); QuickAdd.overlayScreen.remove(); });
		$('.ui-dialog-buttonpane .add').click(function()
		{ 
			// if user wants to add to existing playlist...
			if (!$('#My_Playlists').hasClass('ui-tabs-hide'))
			{
				if (playlistDialogMode == 'artist')
					addTracksFromCurrentArtistToPlaylistName($('#playlistSelection')[0].value);
				else if (playlistDialogMode == 'album')
					addTracksFromCurrentAlbumToPlaylistName($('#playlistSelection')[0].value);
				else if (playlistDialogMode == 'nowplaying')
					addTracksFromNowPlayingToPlaylistName($('#playlistSelection')[0].value);
			}
			// otherwise user is adding to newly defined playlist
			else
			{
				if (playlistDialogMode == 'artist')
					addTracksFromCurrentArtistToPlaylistName($('#playlistName')[0].value.trim(),$('#playlistDescription')[0].value.trim());
				else if (playlistDialogMode == 'album')
					addTracksFromCurrentAlbumToPlaylistName($('#playlistName')[0].value.trim(),$('#playlistDescription')[0].value.trim());
				else if (playlistDialogMode == 'nowplaying')
					addTracksFromNowPlayingToPlaylistName($('#playlistName')[0].value.trim(),$('#playlistDescription')[0].value.trim());
			}
			QuickAdd.playlistDialog.remove(); QuickAdd.overlayScreen.remove(); 
			return false;
		});
		$('#add_to_playlist_dialog ul li:last').click(function()
		{ 
			$(this).addClass('ui-state-active'); 
			$(this).siblings('li').removeClass('ui-state-active'); 
			$('#Create_Playlist').removeClass('ui-tabs-hide');
			$('#My_Playlists').addClass('ui-tabs-hide');
			$('.ui-dialog-buttonpane .add span').text('Create');
			return false; 
		});
		$('#add_to_playlist_dialog ul li:first').click(function()
		{ 
			$(this).addClass('ui-state-active'); 
			$(this).siblings('li').removeClass('ui-state-active'); 
			$('#Create_Playlist').addClass('ui-tabs-hide');
			$('#My_Playlists').removeClass('ui-tabs-hide');
			$('.ui-dialog-buttonpane .add span').text('Add');
			return false; 
		});
		$('#Create_Playlist input,#Create_Playlist textarea').bind('focusin',function()
		{	
			$(this).siblings('label').hide();
		});
		$('#Create_Playlist input,#Create_Playlist textarea').bind('focusout',function()
		{	if ($(this).val().trim().length == 0)
				$(this).siblings('label').show();
		});
		
		QuickAdd.overlayScreen.show();
		QuickAdd.playlistDialog.show();
	}
	
	exports.addIndicatorMessage = addIndicatorMessage;
	exports.addToPlayListLoop = addToPlayListLoop;
	exports.addToPlaylist = addToPlaylist;	
	exports.addTracksFromCurrentAlbumToPlaylist = addTracksFromCurrentAlbumToPlaylist;
	exports.addTracksFromCurrentArtistToPlaylist = addTracksFromCurrentArtistToPlaylist;
	exports.addTracksFromCurrentAlbumToPlaylistName = addTracksFromCurrentAlbumToPlaylistName;
	exports.addTracksFromCurrentArtistToPlaylistName = addTracksFromCurrentArtistToPlaylistName;
	exports.addTracksFromNowPlayingToPlaylist = addTracksFromNowPlayingToPlaylist;
	exports.addTracksFromNowPlayingToPlaylistName = addTracksFromNowPlayingToPlaylistName;
	exports.createPlaylist = createPlaylist;
	exports.displayAddAlbumButton = displayAddAlbumButton;
	exports.displayAddArtistButton = displayAddArtistButton;
	exports.displayAddNowPlayingToPlaylistLink = displayAddNowPlayingToPlaylistLink;
	exports.getCollection = getCollection;
	exports.getCollectionURL = getCollectionURL;
	exports.getCurrentAlbumURL = getCurrentAlbumURL;
	exports.getCurrentAlbumArtLargePath = getCurrentAlbumArtLargePath;
	exports.getCurrentArtistURL = getCurrentArtistURL;
	exports.getPlaylists = getPlaylists;
	exports.getPlaylist = getPlaylist;
	exports.getSearch = getSearch;
	exports.hideFullScreenMode = hideFullScreenMode;
	exports.initFullScreenMode = initFullScreenMode;
	exports.initPlaylistDialog = initPlaylistDialog;
	exports.refreshFullScreenMode = refreshFullScreenMode;
	exports.refreshPlaylistDialogPlaylists = refreshPlaylistDialogPlaylists;
	exports.showFullScreenMode = showFullScreenMode;
	exports.showPlaylistDialog = showPlaylistDialog;
	
	return exports;
};

(function() {
	var s = document.createElement('script');
	s.innerHTML = 'ExtraControls = (' + ExtraControls.toString() + ')(jQuery);';
	document.body.appendChild(s);
	var helpscreen = $('<div id="extracontrols_help" style="display: none; width: 100%; height: 100%; position: absolute; background: rgba(0,0,0,0.7); top: 0; left: 0; z-index: 999999;"><h2 style="font-size: 1.2em; margin-bottom: 0.5em; padding: 5px;">Keyboard Shortcuts</h2><table><tr><td>Left</td><td>Previous Track</td></tr><tr><td>Right</td><td>Next Track</td></tr><tr><td>Spacebar</td><td>Play/Pause</td></tr><tr><td>Cmd+U</td><td>Now Playing</td></tr><tr><td>Cmd+Shift+C</td><td>Collection</td></tr><tr><td>Cmd+Shift+F</td><td>Full Screen</td></tr><tr><td>Cmd+Shift+H</td><td>Home (Dashboard)</td></tr><tr><td>Cmd+Shift+L</td><td>Search focus</td></tr><tr><td>Cmd+Shift+M</td><td>Queue</td></tr><tr><td>Cmd+Shift+N</td><td>History</td></tr><tr><td>Cmd+Shift+P</td><td>Playlists</td></tr><tr><td>Cmd+Shift+X</td><td>Shuffle toggle</td></tr><tr><td>Cmd+Shift+Z</td><td>Repeat toggle</td></tr><tr><td>Cmd+Shift+,</td><td>Help</td></tr></table></div>');
	helpscreen.find('td').css({padding:'5px',fontSize:'0.9em'});
	helpscreen.find('tr td:nth-child(1)').css({textAlign:'left',borderRightSize: '1px', borderRightStyle: 'solid', borderRightColor: '#666'});
	$('#p_column').append(helpscreen);
	s = document.createElement('script');
    s.innerHTML = 'QuickAdd = ('+ QuickAdd.toString() +')(jQuery);';
    document.body.appendChild(s);
})();